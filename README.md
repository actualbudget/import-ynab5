
This is a **beta** importer for YNAB5 (nYNAB) data.

Almost everything should be working now. Subtransactions and imported bank transactions id are still on the works.

## TODO
 - There might be a way to set carryover using internal categories from YNAB (Deferred Income Subcategory and Immediate Income Subcategory)
 - Docs of how credit cards translate from Actual to YNAB
 - Maybe something else I'm missing
 - Remove ynab transfer payees not used by actual
 - Solve subtransactions and imported bank transactions id

We also need to build a simple site that can be hosted on github that authorizes with YNAB and downloads it (there's already a [starter kit](https://github.com/ynab/ynab-api-starter-kit)).


## To run it

Have Actual running locally and run `node index.js /path/to/data.json`.

## Contributions
If you would like to contribute, check out the [documentation for the API](https://actualbudget.com/docs/developers/using-the-API/), specifically about [importers](https://actualbudget.com/docs/developers/using-the-API/#writing-data-importers). All of the available methods can be found [here](https://actualbudget.com/docs/developers/API/).