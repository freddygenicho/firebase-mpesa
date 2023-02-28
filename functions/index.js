const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp();

exports.mpesaCallback = functions.https.onRequest((req, res) => {
    const data = req.body;
    functions.logger.info("Received Data: ", data, { structuredData: true });

    const merchantRequestID = data.Body.stkCallback.MerchantRequestID
    const resultCode = data.Body.stkCallback.ResultCode

    const db = admin.database();
    const mpesaRef = db.ref(`mpesa/stk-callbacks/${merchantRequestID}`);

    const payload = data.Body.stkCallback

    if (resultCode !== 0) {
        payload.Status = "FAILED"
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

        functions.logger.info("New Payload: ", payload, { structuredData: true });
    }

    mpesaRef.update(payload).then(() => {
        console.log('Transaction saved to Realtime Database:', data);
        res.sendStatus(200);
    }).catch(error => {
        console.error('Realtime Database error:', error);
        res.sendStatus(500);
    });
});

