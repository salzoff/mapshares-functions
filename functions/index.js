const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const firestore = admin.firestore();
const GeoFirestore = require('geofirestore').GeoFirestore;
const geoCollection = new GeoFirestore(firestore).collection('geoLocation');
const guestRole = firestore.collection('userRoles').doc('0c5dcOJ5B8fLrcPVJ2fS');

let lastCacheUpdate = null;
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

exports.createUserProfile = functions.firestore
    .document('userProfile/{uid}').onCreate((snap, context) => {
        return snap.ref.update({
            createdAt: new Date(),
            lastLogin: new Date(),
            userRole: guestRole
        });
    });

exports.addBoxCollectionInGeoCollection = functions.firestore
    .document('box/{uid}').onCreate((snap, context) => {
        const data = snap.data();
        return geoCollection.doc(snap.id).set({
            coordinates: data.position,
            objectType: 2,
            ref: snap.ref
        });
    });

/* exports.addHintInGeoCollection = functions.firestore
    .document('/box/{bid}/hints/{uid}').onCreate((snap, context) => {
        const data = snap.data();
        if (data.type === 1) {
            return geoCollection.doc(snap.id).set({
                coordinates: data.position,
                range: data.distanceRange,
                objectType: 3,
                ref: snap.ref
            });
        }
        return 0;
    }); */
