const Nightmare = require('nightmare')
const nightmare = Nightmare({ show: true })

const { JSDOM } = require('jsdom')
const { window } = new JSDOM()
const $ = require('jquery')(window)

const util = require('util')

const fs = require('fs')
const mkdir = util.promisify(fs.mkdir)
const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)

async function search() {
    await nightmare.goto('https://cfp-calculate.tw/cfpc/Carbon/WebPage/visitors/FLProductinfo.aspx')
        .click('#ContentPlaceHolder1_sgv_btn_ProductNameCh_0')
        .wait('.btn-gallery')

    let html = await nightmare.evaluate(() => document.documentElement.innerHTML
    )

    let dataObj = {}


    $(html).find('.btn-gallery img').each((i, img) => {
        console.log('i', i);
        // dataObj[`img${i}`] = $(img).attr('src')
        saveData($(img).attr('src'))
    })
    // writeJson(dataObj)
}

async function saveData(src) {
    const imgSrc = src;
    function delaySave(imgSrc) {
        fetch('http://127.0.0.1:5000/db/img', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ src: JSON.stringify(src) })
        })
            .then((r) => r.json())
            .then((res) => console.log('res', res))
    }

    setTimeout(() => {
        delaySave()
    }, 5000);
}


async function writeJson(data) {
    if (!fs.existsSync('output')) {
        await mkdir('output', { recursive: true })
    }

    await writeFile(
        "output/test.json",
        JSON.stringify(data, null, 2)
    )
}

search()