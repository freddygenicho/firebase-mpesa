const admin = require('firebase-admin');
const functions = require('firebase-functions');
const camelCase = require("lodash/camelCase")

admin.initializeApp();

const camelizeKeys = (obj) => {
    if (Array.isArray(obj)) {
        return obj.map(v => camelizeKeys(v));
    } else if (obj != null && obj.constructor === Object) {
        return Object.keys(obj).reduce(
            (result, key) => ({
                ...result,
                [camelCase(key)]: camelizeKeys(obj[key]),
            }),
            {},
        );
    }
    return obj;
};

/**
 * This function uses the functions.https.onRequest trigger to listen for incoming HTTP requests. . 
 * When a request is received, it saves it into firebase database
 */
exports.mpesaStkCallback = functions.https.onRequest((req, res) => {
    const data = req.body;
    functions.logger.info("Received Data: ", data, { structuredData: true });

    const merchantRequestID = data.Body.stkCallback.MerchantRequestID
    const resultCode = data.Body.stkCallback.ResultCode

    const db = admin.database();
    const mpesaRef = db.ref(`mpesa/stk/${merchantRequestID}`);

    const payload = data.Body.stkCallback
    let final;

    if (resultCode !== 0) {
        payload.Status = "FAILED"
        final = camelizeKeys(payload)
    } else {
        payload.Status = "SUCCESS"

        //Flatten callback metadata into an Object
        const metaData = payload.CallbackMetadata.Item.reduce((acc, cur) => {
            if (cur.Value) {
                acc[cur.Name] = cur.Value;
            } else {
                acc[cur.Name] = null;
            }
            return acc;
        }, {});

        Object.assign(payload, metaData)

        //remove callback metadata from payload
        delete payload.CallbackMetadata

        final = camelizeKeys(payload)
    }

    //Update Mpesa Transaction
    mpesaRef.update(final).then(() => {
        console.log('Transaction saved to Realtime Database:', data);
        res.sendStatus(200);
    }).catch(error => {
        console.error('Realtime Database error:', error);
        res.sendStatus(500);
    });
});

