
This is an **in-progress** importer for YNAB5 (nYNAB) data. It doesn't work yet and I'm looking for community contributions to build it out.

Check out the [documentation for the API](https://actualbudget.com/docs/developers/using-the-API/), specifically about [importers](https://actualbudget.com/docs/developers/using-the-API/#writing-data-importers). All of the available methods can be found [here](https://actualbudget.com/docs/developers/API/).

## TODO

I built this first prototype assuming it would take the data dump given from the [get budget](https://api.youneedabudget.com/v1#/Budgets/getBudgetById) endpoint. Turns out when you "Export Budget" in the UI it gives you something completely different: a zip file of two CSV files. The data isn't nearly as detailed/structured.

At first I thought we should work with the CSV files, as that's the most natural path users are going to go. But after thinking about it, the JSON dump is so much easier to work with (and more accurate), and it's not that hard to get users the dump. We need to build a simple site that can be hosted on github that authorizes with YNAB and downloads it (there's already a [starter kit](https://github.com/ynab/ynab-api-starter-kit)).

I'm not exactly sure if credit card categories and goals effect anything. I've never understood how they deal with credit cards so there might be some stuff there to figure out.

## To run it

Have Actual running locally and run `node index.js /path/to/data.json`.