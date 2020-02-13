
This is an **in-progress** importer for YNAB5 (nYNAB) data. It doesn't work yet and I'm looking for community contributions to build it out.

Check out the [documentation for the API](https://actualbudget.com/docs/developers/using-the-API/), specifically about [importers](https://actualbudget.com/docs/developers/using-the-API/#writing-data-importers). All of the available methods can be found [here](https://actualbudget.com/docs/developers/API/).

## TODO

**Note**: it turns out that the data YNAB5 exports to is different than what I assumed. They have an API with a [get budget](https://api.youneedabudget.com/v1#/Budgets/getBudgetById) endpoint that returns what you see in example.json: a JSON structure that's nicely structured. But when you actually go and export your budget from the UI ("Export Budget" in the menu) you get a zip of two CSV files that is just a dump of your budget and all transactions.

This is unfortunate, but I think you can reconstruct what is needed to import all your data. You will lose various things (like the default category a payee has, and lots of details like that) but you will have all your transactions and budget info.

I'm not exactly sure if credit card categories and goals effect anything. I've never understood how they deal with credit cards so there might be some stuff there to figure out.

## To run it

Have Actual running locally and run `node index.js /path/to/data.json`. (See above, looks like we need to read CSV files...)