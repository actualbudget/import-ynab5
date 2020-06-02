const fs = require('fs');
const os = require('os');
const { join } = require('path');
const d = require('date-fns');
const uuid = require('uuid');
const actual = require('@actual-app/api');
const { amountToInteger } = actual.utils;

function amountFromYnab(amount) {
  // ynabs multiplies amount by 1000 and actual by 100
  // so, this function divides by 10
  return amount/10;
}

function monthFromDate(date) {
  let parts = date.split('-');
  return parts[0] + '-' + parts[1];
}

function mapAccountType(type) {
  switch (type) {
    case 'cash':
    case 'checking':
      return 'checking';
    case 'creditCard':
    case 'lineOfCredit':
      return 'credit';
    case 'savings':
      return 'savings';
    case 'investmentAccount':
      return 'investment';
    case 'mortgage':
      return 'mortgage';
    default:
      return 'other';
  }
}

function sortByKey(arr, key) {
  return [...arr].sort((item1, item2) => {
    if (item1[key] < item2[key]) {
      return -1;
    } else if (item1[key] > item2[key]) {
      return 1;
    }
    return 0;
  });
}

function groupBy(arr, keyName) {
  return arr.reduce(function(obj, item) {
    var key = item[keyName];
    if (!obj.hasOwnProperty(key)) {
      obj[key] = [];
    }
    obj[key].push(item);
    return obj;
  }, {});
}

function importAccounts(data, entityIdMap) {
  
  return Promise.all(
    data.accounts.map(async account => {
      if (!account.deleted) {
        let id = await actual.createAccount({
          type: mapAccountType(account.type),
          name: account.name,
          offbudget: account.on_budget ? false : true,
          closed: account.closed
        });
        entityIdMap.set(account.id, id);
      }
    })
  );
}

async function importCategories(data, entityIdMap) {
  // Hidden categories are put in its own group by YNAB,
  // so it's already handled.

  const categories = await actual.getCategories();
  const incomeCatId = categories.find(cat => cat.name === 'Income').id;
  
  function checkSpecialCat(cat) {
    if (cat.category_group_id === 
          data.category_groups.find(group =>
            group.name === "Internal Master Category").id) {

      if (cat.name === "To be Budgeted") {
        return "income";
      } else {
        return "internal";
      }
    }
    else if (cat.category_group_id === 
      data.category_groups.find(group =>
        group.name === "Credit Card Payments").id) {

      return "creditCard";
    }
    
  }
  // Can't be done in parallel to have
  // correct sort order.

  for (group of data.category_groups) {
    if (!group.deleted) {

      // Ignores internal category and credit cards
      if (group.name !== "Internal Master Category" &&
          group.name !== "Credit Card Payments") {
        
        var groupId = await actual.createCategoryGroup({
          name: group.name,
          is_income: false
        });
        entityIdMap.set(group.id, groupId);
      }

      cats = data.categories.filter(cat => cat.category_group_id === group.id);

      for (cat of cats.reverse()) {
        
        if (!cat.deleted) {
          newCategory = {};
          newCategory.name = cat.name;

          // Handles special categories. Starting balance is a payee
          // in YNAB so it's handled in importTransactions
          switch (checkSpecialCat(cat)) {
            case "income":    // doesn't create new category, only assigns id
              id = incomeCatId;
              entityIdMap.set(cat.id, id);  
              break;
            case "creditCard":  // ignores it
            case "internal":    // uncategorized is ignored too, handled by actual
              break;
            default:
              newCategory.group_id = groupId;
              id = await actual.createCategory(newCategory);
              entityIdMap.set(cat.id, id);  
              break;
          }
        }
      }
    }
  }
}

function importPayees(data, entityIdMap) {
  
  return Promise.all(
    data.payees.map(async payee => {
      if (!payee.deleted) {
        let id = await actual.createPayee({
          name: payee.name,
        });
      entityIdMap.set(payee.id, id);
      
      }
    })
  );
}

async function importTransactions(data, entityIdMap) {
  // TODO: Handle subtransactions and imported transactions
  // Also, is there any way to mark cleared?

  const payees = await actual.getPayees();
  const categories = await actual.getCategories();
  const incomeCatId = categories.find(cat => cat.name === 'Income').id;
  const startingBalanceCatId = categories.find(cat => cat.name === 'Starting Balances').id; //better way to do it?
  const startingPayeeYNAB = data.payees.find(payee => payee.name === 'Starting Balance').id;

  let transactionsGrouped = groupBy(data.transactions, 'account_id');
  
  // Go ahead and generate ids for all of the transactions so we can
  // reliably resolve transfers
  for (let transaction of data.transactions) {
    entityIdMap.set(transaction.id, uuid.v4());
  }
  
  await Promise.all(
    
    Object.keys(transactionsGrouped).map(async accountId => {
      let transactions = transactionsGrouped[accountId];

      let toImport = transactions.map(transaction => {
          if (transaction.deleted) {
            return;
          }
          let newTransaction = {
            id: entityIdMap.get(transaction.id),  
            account_id: entityIdMap.get(transaction.account_id),
            date: transaction.date,
            amount: amountFromYnab(transaction.amount),  
            category_id: entityIdMap.get(transaction.category_id) || null,
            notes: transaction.memo || null,
            //imported_id,
            transfer_id: entityIdMap.get(transaction.transfer_transaction_id) || null
            //subtransactions,
          };

          // Handle transfer payee
          if (transaction.transfer_account_id) {
            newTransaction.payee_id = payees.find(
              p =>
                p.transfer_acct === entityIdMap.get(transaction.transfer_account_id)
            ).id;
          } else {
            newTransaction.payee_id = entityIdMap.get(transaction.payee_id);
          }

          // Handle starting balances
          if (transaction.payee_id === startingPayeeYNAB &&
              entityIdMap.get(transaction.category_id) === incomeCatId
            ) {
            newTransaction.category_id = startingBalanceCatId;
            newTransaction.payee_id = null;
          }
          return newTransaction;
        })
        .filter(x => x);
      
      await actual.addTransactions(entityIdMap.get(accountId), toImport);
    })
  );
}

async function importBudgets(data, entityIdMap) {
  // There should be info in the docs to deal with
  // no credit card category and how YNAB and Actual
  // handle differently the amount To be Budgeted
  // i.e. Actual considers the cc debt while YNAB doesn't
  //
  // Also, there could be a way to set rollover using
  // Deferred Income Subcat and Immediate Income Subcat

  let budgets = sortByKey(data.months, 'month');

  const internalCatIdYnab = data.category_groups.find(
    group =>
      group.name === "Internal Master Category"
  ).id
  const creditcardCatIdYnab = data.category_groups.find(
    group =>
      group.name === "Credit Card Payments"
  ).id 

  await actual.batchBudgetUpdates(async () => {
   
    for (let budget of budgets) {
      let month = monthFromDate(budget.month);

      await Promise.all(
        budget.categories.map(async catBudget => {
          let catId = entityIdMap.get(catBudget.id);
          let amount = catBudget.budgeted/10;
          
          if (!catId ||
              catBudget.category_group_id === internalCatIdYnab ||
              catBudget.category_group_id === creditcardCatIdYnab                
              ) {
            return;
          }

          await actual.setBudgetAmount(month, catId, amount);
        })
      );
    }
  });
}

// Utils

async function doImport(data) {
  const entityIdMap = new Map();

  console.log('Importing Accounts...');
  await importAccounts(data, entityIdMap);

  console.log('Importing Categories...');
  await importCategories(data, entityIdMap);

  console.log('Importing Payees...');
  await importPayees(data, entityIdMap);

  console.log('Importing Transactions...');
  await importTransactions(data, entityIdMap);

  console.log('Importing Budgets...');
  await importBudgets(data, entityIdMap);

  console.log('Setting up...');
}

async function importYNAB5(filepath) {
  let contents;
  try {
    contents = fs.readFileSync(filepath, 'utf8');
  } catch (e) {
    throw new Error('Error reading file');
  }

  let data;
  try {
    data = JSON.parse(contents);
  } catch (e) {
    throw new Error('Error parsing file');
  }

  return actual.runImport(data.data.budget.name, () =>
    doImport(data.data.budget)
  );
}

module.exports = { importYNAB5 };