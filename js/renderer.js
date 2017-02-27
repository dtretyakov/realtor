const {shell, ipcRenderer} = require('electron');
const cian = require('./parsers/cian.js');
const {MongoClient} = require('mongodb');
const geotools = require("./geotools.js");

let url = 'mongodb://localhost:27017/realtor';

$(document).on('click', 'a[href^="http"]', function (event) {
    event.preventDefault();
    shell.openExternal(this.href);
});

function AppViewModel() {
    let self = this;

    self.offers = ko.observableArray([]);
    self.filters = ko.observableArray([]);
    self.source = ko.observable("");
    self.url = ko.observable("");

    self.addUrl = async function () {
        let db = await MongoClient.connect(url);
        try {
            await db.collection("filters").insertOne({
                _id: {
                    source: self.source(),
                    url: self.url()
                }
            });

        } catch (e) {
            console.log(e);
        } finally {
            db.close();
        }

        ipcRenderer.send('filters', {});
        updateFilters();
        self.url("");
    };

    self.removeUrl = async function (item) {
        let db = await MongoClient.connect(url);
        try {
            await db.collection("filters").removeOne({_id: item});
        } catch (e) {
            console.log(e);
        } finally {
            db.close();
        }

        ipcRenderer.send('filters', {});
        self.filters.remove(item);
    };

    async function updateFilters() {
        self.filters.removeAll();

        let db = await MongoClient.connect(url);
        try {
            let filters = await db.collection("filters").find({}).toArray();
            self.filters.push(...filters.map(filter => {
                return filter._id;
            }));
        } catch (e) {
            console.log(e);
        } finally {
            db.close();
        }
    }

    async function fetchOffers() {
        let db = await MongoClient.connect(url);
        try {
            let offers = await db.collection("offers")
                .find({
                    price: {$lte: 7000000},
                    balcony: true,
                    floor: {$gt: 1},
                    totalArea: {$gte: 37},
                    ignored: {$ne: true},
                    $where: '(this.stations.length > 0)',
                    description: {$not: /(смежные|ЦИАН не рекомендует|апартамент)/}
                })
                .sort({price: 1})
                .toArray();

            self.offers.push(...offers.filter(offer => {
                offer.totalArea = offer.totalArea || 0;
                offer.livingArea = offer.livingArea || 0;
                offer.kitchenArea = offer.kitchenArea || 0;
                return offer.floor < offer.floorsCount && (offer.floorsCount > 5 || offer.floor == 2);
            }));
        } catch (e) {
            console.log(e);
        } finally {
            db.close();
        }
    }

    updateFilters();
    fetchOffers();
}

ipcRenderer.on('offers', () => {
    fetchOffers();
});

// Activates knockout.js
ko.applyBindings(new AppViewModel(), window.document.body);