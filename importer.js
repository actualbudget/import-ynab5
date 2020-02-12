const fs = require('fs');
const os = require('os');
const { join } = require('path');
const d = require('date-fns');
const uuid = require('uuid');
const actual = require('@actual-app/api');
const { amountToInteger } = actual.utils;

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
  // TODO: Test this. this should be all you need.

  return Promise.all(
    data.accounts.map(async account => {
      if (!account.deleted) {
        let id = await actual.createAccount({
          type: mapAccountType(account.type),
          name: account.name,
          offbudget: account.on_budget ? false : true,
          closed: account.closed
        });
        entityIdMap.set(account.entityId, id);
      }
    })
  );
}

function importCategories(data, entityIdMap) {
  // TODO: Handle hidden categories somehow. Also looks like it
  // doesn't give us sort order.

  return Promise.all(
    data.category_groups.map(async group => {
      if (group.deleted) {
        return;
      }

      let groupId = await actual.createCategoryGroup({
        name: group.name,
        is_income: false
      });
      entityIdMap.set(group.id, groupId);

      return Promise.all(
        data.categories
          .filter(cat => cat.category_group_id === group.id)
          .map(async cat => {
            if (cat.deleted) {
              return;
            }

            const id = await actual.createCategory({
              name: cat.name,
              group_id: groupId
            });
            entityIdMap.set(category.entityId, id);
          })
      );
    })
  );
}

function importPayees(data, entityIdMap) {
  // TODO: Implement this

  for (let payee of data.payees) {
    if (!payee.deleted) {
    }
  }
}

function importTransactions(data, entityIdMap) {
  // TODO: This is barebones. Implement the code inside of the
  // mapping which generates `toImport`. Need to handle transfers, map
  // to the right payee ids, and handle subtransactions.

  let transactionsGrouped = groupBy(data.transactions, 'account_id');

  return Promise.all(
    Object.keys(transactionsGrouped).map(async accountId => {
      let transactions = transactionsGrouped[accountId];

      let toImport = transactions
        .map(transaction => {
          if (transaction.deleted) {
            return;
          }
        })
        .filter(x => x);

      await actual.addTransactions(entityIdMap.get(accountId), toImport);
    })
  );
}

async function importBudgets(data, entityIdMap) {
  // TODO: Since nYNAB doesn't support carryover, this might be all we
  // need to do? Do we need to think about hidden/deleted categories
  // at all?

  let budgets = sortByKey(data.months, 'month');

  await actual.batchBudgetUpdates(async () => {
    for (let budget of budgets) {
      let month = monthFromDate(budget.month);

      await Promise.all(
        budget.categories.map(async catBudget => {
          let catId = entityIdMap.get(catBudget.id);
          let amount = amountToInteger(catBudget.budgeted);
          if (!catId) {
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
