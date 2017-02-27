const roomsRegex = /Продается\s(\d)/;
const coordinateRegex = /var coordinate = \[([^\]]+)/;
const totalAreaRegex = /Площадь:\s([^\s]+)/;
const floorRegex = /Этаж:\s([\d]+)\s\/\s([\d]+)/;
const kitchenAreaRegex = /Кухня:\s([^\s]+)/;
const livingAreaRegex = /Жилая:\s([^\s]+)/;
const elevatorRegex = /Лифт:\s([^\s]+)/;
const balconyRegex = /Балкон\/лоджия:\s([^\s]+)/;

async function getFromUrlAsync(url) {
    let page = 1;
    let apartments = {};

    while (true) {
        let data = await $.get(url + "&page=" + page++);

        let html = $(data);
        html.find('.b-adCard').each(function () {
            let item = $(this);

            let id = item.find(".b-adCard__favourite > div").attr("data-id");
            let linkElement = item.find(".b-adCard__link");
            let link = "http:" + linkElement.attr("href");
            let address = (item.find(".b-adAddress__more").text() +
                item.find(".b-adAddress").text())
                .trim()
                .replace(/[\s]+/g, " ")
                .replace("г. Москва", "Москва,")
                .replace(" ,", ",");
            let price = parseInt(item.find(".b-adPrice").text().trim().replace(/(\s|Р)/g, ""));
            let roomsCount = parseInt(roomsRegex.exec(linkElement.text())[1]);
            let text = item.text().trim().replace(/[\s]+/g, " ");
            let totalArea = totalAreaRegex.exec(text)[1];
            let floor = floorRegex.exec(text);
            let images = item.find(".fotorama > a").map(function(i, anchor) {
                return anchor.href;
            });

            let apartment = {
                id: id,
                source: 'sob',
                address: address,
                price: price,
                totalArea: parseFloat(totalArea),
                roomsCount: roomsCount,
                images: Array.from(images).filter(image => {
                    return image.indexOf("noImage.png") < 0;
                }),
                link: link,
                floor: parseInt(floor[1]),
                floorsCount: parseInt(floor[2])
            };

            apartments[id] = apartment;
        });

        if (html.find(".b-pagination li:nth-last-child(2)").hasClass("b-pagination__link-active")) {
            break;
        }
    }

    for (let id of Object.keys(apartments)) {
        let apartment = apartments[id];
        let data = await $.get(apartment.link);
        let html = $(data);

        try {
            let coordinate = coordinateRegex.exec(data)[1].split(",");
            apartment.point = [
                parseFloat(coordinate[1]),
                parseFloat(coordinate[0])
            ];
        } catch (e) {
            console.log(e)
        }

        let card = html.find(".b-card-square").text().trim().replace(/[\s]+/g, " ");
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

        try {
            apartment.elevator = elevatorRegex.exec(card)[1].indexOf("не") < 0;
        } catch (e) {
            apartment.elevator = false;
            console.log(e)
        }

        try {
            apartment.balcony = balconyRegex.exec(card)[1].indexOf("не") < 0;
        } catch (e) {
            apartment.balcony = false;
            console.log(e)
        }

        apartment.description = html.find(".b-card-description p:last-child").text().trim();
    }

    return Object.values(apartments);
}

module.exports.getFromUrlAsync = getFromUrlAsync;
