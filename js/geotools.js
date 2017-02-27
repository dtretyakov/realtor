const {MongoClient} = require('mongodb');

let url = 'mongodb://localhost:27017/realtor';

async function findMetroStations(location) {
    let db = await MongoClient.connect(url);
    try {
        let doc = await db.collection("stations").findOne({"_id.lon": location[0], "_id.lat": location[1]});
        if (doc && doc.stations) {
            db.close();
            return doc.stations;
        }
    } catch (e) {
        console.log(e);
    }

    let data = await $.get("http://catalog.api.2gis.ru/geo/search?" +
        "q=" + location[0] + "," + location[1] + "&" +
        "version=1.3&" +
        "key=rudvjt8277&" +
        "types=metro&" +
        "radius=1000");

    let stations = (data.result || []).map(station => {
            return {
                name: station.name.replace("Москва, ", ""),
                dist: station.dist
            }
        }) || [];

    let doc = {
        _id: {lon: location[0], lat: location[1]},
        stations: stations
    };

    try {
        await db.collection("stations").insertOne(doc);
    } catch (e) {
        console.log(e);
    } finally {
        db.close();
    }

    return stations;
}

async function findMetroTime(from, to) {
    let db = await MongoClient.connect(url);
    try {
        let doc = await db.collection("times").findOne({"_id.from": from, "_id.to": to});
        if (doc && doc.time) {
            db.close();
            return doc.time;
        }
    } catch (e) {
        console.log(e);
    }

    let data = await $.get("http://catalog.api.2gis.ru/2.0/transport/calculate_routes?" +
        "start=" + from[0] + "," + from[1] + "&" +
        "end=" + to[0] + "," + to[1] + "&" +
        "key=rudvjt8277&" +
        "route_subtypes=metro");

    let time = (data.result || {items: []}).items.map(item => {
            return item.total_duration;
        }) || [];

    let doc = {
        _id: {from: from, to: to},
        time: time.length > 0 ? time[0] : -1
    };

    try {
        await db.collection("times").insertOne(doc);
    } catch (e) {
        console.log(e);
    } finally {
        db.close();
    }

    return doc.time;
}

async function findBuilding(offer) {
    let db = await MongoClient.connect(url);
    try {
        let doc = await db.collection("buildings").findOne({"_id": offer.address});
        if (doc && doc.point) {
            db.close();
            return doc.point;
        }
    } catch (e) {
        console.log(e);
    }

    let data = await $.get("http://catalog.api.2gis.ru/2.0/geo/search?" +
        "q=" + offer.address + "&" +
        "region_id=32&" +
        "key=rudvjt8277&" +
        "type=building&" +
        "fields=items.geometry.selection");

    let points = (data.result || {items: []}).items.map(item => {
            let selection = item.geometry.selection;
            let point = selection.substring(6, selection.length-1).split(" ");
            return [parseFloat(point[0]), parseFloat(point[1])];
        }) || [];

    let doc = {
        _id: offer.address,
        point: points.length > 0 ? points[0] : offer.point
    };

    doc.point = doc.point || [56, 74];

    try {
        await db.collection("buildings").insertOne(doc);
    } catch (e) {
        console.log(e);
    } finally {
        db.close();
    }

    return doc.point;
}

module.exports.findMetroStations = findMetroStations;
module.exports.findMetroTime = findMetroTime;
module.exports.findBuilding = findBuilding;