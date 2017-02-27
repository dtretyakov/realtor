const {ipcRenderer} = require('electron');
const cian = require('./parsers/cian.js');
const sob = require('./parsers/sob.js');
const avito = require('./parsers/avito.js');
const {MongoClient} = require('mongodb');
const geotools = require("./geotools.js");

let delay = 3600000;
let url = 'mongodb://localhost:27017/realtor';
let handlers = {
    //"cian": cian.getFromUrlAsync,
    //"sob": sob.getFromUrlAsync,
    "avito": avito.getFromUrlAsync
};

async function updateFilters() {
    let db = await MongoClient.connect(url);
    let filters;
    try {
        filters = await db.collection("filters").find({
            $or: [
                {updated: null},
                {updated: { $lte: new Date(Date.now() - delay) }}
            ]
        }).toArray();
    } catch (e) {
        console.log(e);
    }

    for (let i = 0; i < filters.length; i++) {
        let filter = filters[i];
        let handler = handlers[filter._id.source];
        if (!handler) continue;

        let offers = await handler(filter._id.url);
        await Promise.all(offers.map(async function (offer) {
            offer.point = await geotools.findBuilding(offer);
            offer.stations = await geotools.findMetroStations(offer.point);
            offer.timeToWork = await geotools.findMetroTime(offer.point, [37.546721, 55.754023]);
        }));

        try {
            await db.collection("offers").deleteMany({
                source: filter._id.source,
                ignored: {$ne: true}
            });
        } catch (e) {
            console.log(e)
        }

        try {
            await db.collection("offers").insertMany(offers, {ordered: false});
        } catch (e) {
            console.log(e);
        }

        try {
            filter.updated = new Date();
            await db.collection("filters").updateOne({_id: filter._id}, filter);
        } catch (e) {
            console.log(e);
        }
    }

    db.close();

    ipcRenderer.send("offers", {});
}

ipcRenderer.on('filters', () => {
    updateFilters();
});

setInterval(() => {
    updateFilters();
}, 600000);

updateFilters();
