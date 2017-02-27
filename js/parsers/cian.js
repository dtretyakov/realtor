const offersRegex = /window\._offers = (.*);/;
const idRegex = /\/sale\/flat\/(\d+)/;
const kitchenAreaRegex = /кухня\s([^\s]+)/;
const livingAreaRegex = /жилая\s([^\s]+)/;

async function getFromUrlAsync(url) {
    let page = 1;
    let apartments = {};

    while (true) {
        let data = await $.get(url + "&p=" + page++);

        let result = offersRegex.exec(data);
        if (!result) return apartments;

        let offers = JSON.parse(result[1]);

        Object.keys(offers).forEach(function (id) {
            let offer = offers[id];
            apartments[id] = {
                id: id,
                source: 'cian',
                address: offer.address_string[0],
                price: offer.price.rur,
                totalArea: offer.total_area,
                roomsCount: offer.rooms_count,
                point: [offer.center[1], offer.center[0]],
                images: offer.photos.map(function (photo) {
                    return photo.img;
                }),
                floor: offer.floor,
                floorsCount: offer.floors_count
            };
        });

        let html = $(data);
        html.find('.serp-item').each(function () {
            let item = $(this);

            let link = item.find(".serp-item__card-link").attr("href");
            let id = idRegex.exec(link)[1];

            // skip adverts
            if (item.find(".serp-item__address-newobject").length > 0) {
                delete apartments[id];
                return;
            }

            let apartment = apartments[id];
            if (!apartment) {
                console.log("Invalid id " + id);
                return;
            }

            let floorText = item.find(".serp-item__floor-col").text();
            apartment.balcony = floorText.indexOf("нет балкона") < 0;
            apartment.elevator = floorText.indexOf("нет лифта") < 0;

            let areaText = item.find(".serp-item__area-col").text().trim();
            try {
                apartment.kitchenArea = parseFloat(kitchenAreaRegex.exec(areaText)[1].replace(',', '.'));
            } catch (error) {
            }

            try {
                apartment.livingArea = parseFloat(livingAreaRegex.exec(areaText)[1].replace(',', '.'));
            } catch (error) {
                apartment.livingArea = apartment.totalArea;
            }

            apartment.link = link;
            apartment.description = item.find(".serp-item__description__text").text().trim();
        });

        if (html.find(".pager_pages :last-child").prop("tagName") == "SPAN") {
            return Object.values(apartments);
        }
    }
}

module.exports.getFromUrlAsync = getFromUrlAsync;
