const roomsRegex = /Количество комнат:[\s]+(\d)/;
const totalAreaRegex = /Общая площадь:[\s]+([^\s]+)/;
const floorRegex = /Этаж:[\s]+([\d]+)/;
const floorsRegex = /Этажей в доме:[\s]+([\d]+)/;
const kitchenAreaRegex = /Площадь кухни:\s([^\s]+)/;
const livingAreaRegex = /Жилая площадь:\s([^\s]+)/;
const balconyRegex = /(балкон|лоджи)/i;
const noBalconyRegex = /(нет|без|отсутствует)\s(балкон|лоджи)/i;
const blockedRegex = /Доступ с Вашего IP временно ограничен/i;

const {MongoClient} = require('mongodb');

let mongoDBUrl = 'mongodb://localhost:27017/realtor';

async function getFromUrlAsync(url) {
    let page = 1;
    let apartments = {};

    while (true) {
        let data = await $.get(url + "&p=" + page++);
        if (blockedRegex.test(data)) break;

        let html = $(data);
        html.find('.item').each(function () {
            let item = $(this);
            let id = parseInt(item.attr("id").substring(1));
            let link = "https://www.avito.ru" + item.find("a.item-description-title-link").attr("href");

            apartments[id] = {
                id: id,
                source: 'avito',
                link: link
            };
        });

        if (html.find(".pagination-pages :last-child").prop("tagName") == "SPAN") {
            break;
        }
    }

    let db = await MongoClient.connect(mongoDBUrl);
    let blocked = false;
    for (let id of Object.keys(apartments)) {
        if (blocked) {
            delete apartments[id];
            continue;
        }

        let apartment = apartments[id];

        let data = await getTextAsync(db, apartment);
        if (!data) {
            blocked = true;
            delete apartments[id];
            continue;
        }

        let html = $(data);

        let card = html.find(".item-view-block").text().trim().replace(/[\s]+/, " ");
        try {
            apartment.roomsCount = parseInt(roomsRegex.exec(card)[1]);
        } catch (e) {
            console.log(e)
        }

        try {
            apartment.floor = parseInt(floorRegex.exec(card)[1]);
        } catch (e) {
            console.log(e)
        }

        try {
            apartment.floorsCount = parseInt(floorsRegex.exec(card)[1]);
        } catch (e) {
            console.log(e)
        }

        apartment.price = parseInt(html.find(".price-value-string:first").text().trim().replace(/(₽|\s)/g, ""));
        apartment.address = html.find(".seller-info .seller-info-prop:last .seller-info-value").text()
            .trim()
            .replace(/, (м. [^,]+),/, ",")
            .replace("Москва, Москва", "Москва");
        apartment.description = html.find(".item-description p").text().trim();

        try {
            apartment.totalArea = parseFloat(totalAreaRegex.exec(card)[1]);
        } catch (e) {
            console.log(e)
        }

        try {
            apartment.livingArea = parseFloat(livingAreaRegex.exec(card)[1]);
        } catch (e) {
            console.log(e)
        }

        try {
            apartment.kitchenArea = parseFloat(kitchenAreaRegex.exec(card)[1]);
        } catch (e) {
            console.log(e)
        }

        let images = html.find(".gallery-extended-imgs-wrapper > .gallery-extended-img-frame").map(function (i, div) {
            return "https:" + $(div).attr("data-alt-url");
        });

        apartment.images = Array.from(images);
        apartment.balcony = balconyRegex.test(apartment.description) &&
            !noBalconyRegex.test(apartment.description);
    }

    db.close();

    return Object.values(apartments);
}

async function getTextAsync(db, apartment) {
    try {
        let doc = await db.collection("avito").findOne({"_id": apartment.id});
        if (doc && doc.text) {
            return doc.text;
        }
    } catch (e) {
        console.log(e);
    }

    let data = await $.get(apartment.link);
    if (blockedRegex.test(data)) {
        return null;
    }

    try {
        await db.collection("avito").insertOne({
            _id: apartment.id,
            text: data
        });
    } catch (e) {
        console.log(e);
        return null;
    }

    return data;
}

module.exports.getFromUrlAsync = getFromUrlAsync;
