const Nightmare = require('nightmare')
const nightmare = Nightmare({ show: true, openDevTools: true })

const { JSDOM } = require('jsdom')
const { window } = new JSDOM()
const $ = require('jquery')(window)

const util = require('util')

const fs = require('fs')
const mkdir = util.promisify(fs.mkdir)
const readFile = util.promisify(fs.readFile)
const writeFile = util.promisify(fs.writeFile)

const productUrls = []
const certificateNumArray = []
let productDict = {}

let page = 0
let maxPage = 50

async function getProductsUrl(prevHtml) {
    console.log('getProductsUrl')

    let html = null
    if (!prevHtml) {
        await nightmare.goto(
            'https://cfp-calculate.tw/cfpc/Carbon/WebPage/visitors/FLProductinfo.aspx'
        )
        html = await nightmare.evaluate(
            () => document.documentElement.innerHTML
        )
    } else {
        html = prevHtml
    }

    const products = $(html).find('#ContentPlaceHolder1_sgv tbody tr')

    products.each((i, product) => {
        const certificateNum = $(product).find('td').eq(0).text()
        const productLinkDom = $(product).find('td').eq(1).find('a')
        const serialNo = productLinkDom.attr('serialno')
        const productName = productLinkDom.text()
        const url = `https://cfp-calculate.tw/cfpc/Carbon/WebPage/visitors/FLProductinfoView.aspx?SerialNo=${serialNo}`

        if (serialNo) {
            certificateNumArray.push(certificateNum)
            productUrls.push(url)

            if (productDict[certificateNum]) {
                // console.log('url', url)
                // console.log('productName', productName)
                // console.log('certificateNum', certificateNum)
                // console.log('page', page)
                // console.log(
                //     'productDict[certificateNum]',
                //     productDict[certificateNum]
                // )
            } else {
                productDict[certificateNum] = {
                    url: url,
                    productName: productName,
                    page: page,
                }
            }
        } else {
            console.log('no SerialNo:', certificateNum)
        }
    })

    page++
    maxPage = $(html).find('.pagerfocus').last().text()

    console.log('page:', page, 'maxPage:', maxPage)
    if (page < maxPage) {
        try {
            await nightmare
                .click(
                    '#ContentPlaceHolder1_sgv > tbody > tr:nth-child(12) > td > a:nth-child(14)'
                )
                .wait('.pagerfocus')
        } catch (e) {
            console.log('e', e)
        }

        await sleep(1000)

        const newHtml = await nightmare.evaluate(
            () => document.documentElement.innerHTML
        )

        setTimeout(() => {
            getProductsUrl(newHtml)
        }, 3000)
    } else {
        writeJson()
    }
}

const sleep = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

const awaitSave = (src, product, index) => {
    return sleep(3000).then((v) => saveData(src, product, index))
}

async function productUrlsLoop() {
    console.log('productUrlsLoop start')
    let products = JSON.parse(await readFile('./output/productDict.json'))
    productDict = JSON.parse(await readFile('./output/productDict.json'))

    for (const [serialNo, data] of Object.entries(products)) {
        await getImgs(data.url, serialNo, data.productName)
    }
}

async function getImgs(url, serialNo, productName) {
    try {
        await nightmare.goto(url).wait('.btn-gallery img')

        await sleep(10000).then(() => {
            console.log('getImgs', url)
        })

        let html = await nightmare.evaluate(
            () => document.documentElement.innerHTML
        )

        const imgArray = []

        const imgs = $(html).find('.btn-gallery img')

        if (imgs.length > 0) {
            imgs.each((i, img) => {
                imgArray.push($(img).attr('src'))
            })
        }

        if (imgArray.length > 0) {
            delete productDict[serialNo]
            for (const [i, src] of imgArray.entries()) {
                await saveData(src, productName, i + 1, serialNo)
            }
            writeJson()
        }
    } catch (error) {}
}

async function saveData(src, productName, index, serialNo) {
    console.log('saveData:', productName, index)
    await sleep(1000)
    try {
        function decodeBase64Image(dataString) {
            var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/)
            var response = {}

            if (matches.length !== 3) {
                return new Error('Invalid input string')
            }

            response.type = matches[1]
            response.data = new Buffer(matches[2], 'base64')

            return response
        }

        // Regular expression for image type:
        // This regular image extracts the "jpeg" from "image/jpeg"
        var imageTypeRegularExpression = /\/(.*?)$/

        // Generate random string
        var crypto = require('crypto')
        var seed = crypto.randomBytes(20)
        var uniqueSHA1String = crypto
            .createHash('sha1')
            .update(seed)
            .digest('hex')

        var base64Data = src

        var imageBuffer = decodeBase64Image(base64Data)
        var userUploadedFeedMessagesLocation = './output'

        var uniqueRandomImageName = serialNo + '_' + productName + '_' + index
        // This variable is actually an array which has 5 values,
        // The [1] value is the real image extension
        var imageTypeDetected = imageBuffer.type.match(
            imageTypeRegularExpression
        )

        var folder =
            userUploadedFeedMessagesLocation + '/' + serialNo + productName

        if (!fs.existsSync(folder)) {
            await mkdir(folder, { recursive: true })
        }

        var userUploadedImagePath =
            folder + '/' + uniqueRandomImageName + '.' + imageTypeDetected[1]

        // Save decoded binary image to disk
        try {
            require('fs').writeFile(
                userUploadedImagePath,
                imageBuffer.data,
                function () {
                    console.log(
                        'DEBUG - feed:message: Saved to disk image attached by user:',
                        userUploadedImagePath
                    )
                }
            )
        } catch (error) {
            console.log('ERROR:', error)
        }
    } catch (error) {
        console.log('ERROR:', error)
    }
}

async function writeJson() {
    console.log('writeJson')
    if (!fs.existsSync('output')) {
        await mkdir('output', { recursive: true })
    }

    await writeFile(
        'output/productDict.json',
        JSON.stringify(productDict, null, 2)
    )
}

async function checkImgsWithJson() {
    const productsDict = JSON.parse(await readFile('./output/productDict.json'))
    const productsArray = Object.entries(productsDict).filter((data) => {
        return fs.existsSync(data[0] + data[1].productName)
    })
}
