/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1897857566")

  // remove field
  collection.fields.removeById("number2765490009")

  // add field
  collection.fields.addAt(1, new Field({
    "hidden": false,
    "id": "file416669013",
    "maxSelect": 1,
    "maxSize": 0,
    "mimeTypes": [],
    "name": "materiau",
    "presentable": false,
    "protected": false,
    "required": false,
    "system": false,
    "thumbs": [],
    "type": "file"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1897857566")

  // add field
  collection.fields.addAt(1, new Field({
    "hidden": false,
    "id": "number2765490009",
    "max": null,
    "min": null,
    "name": "libelle",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  // remove field
  collection.fields.removeById("file416669013")

  return app.save(collection)
})
