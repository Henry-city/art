# Articulated Assets

Static asset gallery and Source Data browser. No build step or dependencies are required.

## Local preview

From this directory, run `python -m http.server 8765 --bind 127.0.0.1` and open:

- Gallery: http://127.0.0.1:8765/
- Source Data: http://127.0.0.1:8765/source-data.html

## Source Data

`assets/source-data/catalog.js` is the category manifest. The collection has 300 cases: cabinets, office chairs, microwaves, toilets, and washing machines, with 60 cases per category. These totals were supplied by the dataset owner; they are not inferred from the number of preview PDFs.

The five supplied PDFs are representative manuals, one per category. Original files are stored as `assets/source-data/<id>/manual.pdf`. Page previews use `page-01.jpg`, `page-02.jpg`, etc. The browser supports category filters, model search, and a keyboard-accessible dialog with page selection and links to original PDFs.

To update category totals, edit `count` in the manifest. To replace a representative manual, update its metadata, PDF, and numbered page images together. There is no fabricated list of 300 individual records.
