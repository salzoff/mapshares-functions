const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const firestore = admin.firestore();
const GeoFirestore = require('geofirestore').GeoFirestore;
const geoCollection = new GeoFirestore(firestore).collection('geoLocation');
const userCollection = firestore.collection('userProfile');
const playerRole = firestore.collection('userRoles').doc('rh3NSk8aPOjXVGUYwPjQ');
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();
const spawn = require('child-process-promise').spawn;
const path = require('path');
const os = require('os');
const fs = require('fs');

let lastCacheUpdate = null;
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
// exports.helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

exports.addBoxCollectionInGeoCollection = functions.firestore
    .document('box/{uid}').onCreate((snap, context) => {
        const data = snap.data();
        return geoCollection.doc(snap.id).set({
            coordinates: data.position,
            value: data.value,
            objectType: data.isPhysical ? 3 : 2,
            ref: snap.ref
        });
    });

exports.updateBoxInGeoCollection = functions.firestore
    .document('box/{uid}').onUpdate(change => {
        const data = change.after.data();
        return geoCollection.doc(change.after.id).update({
            coordinates: data.position,
            value: data.value,
            objectType: data.foundBy ? 4 : data.isPhysical ? 3 : 2,
        });
    });

exports.deleteBox = functions.firestore
    .document('box/{uid}').onDelete(snap => {
        geoCollection.doc(snap.id).delete();
        return snap.ref.collection('hints').get().then(querySnapshot => {
            querySnapshot.forEach(doc => {
                geoCollection.doc(doc.id + 'hint').delete();
            });
            return true;
        }).catch(err => {
            console.error(err);
        });
    });

exports.createUserProfile = functions.https.onCall((data, context) => {
    return userCollection.doc(data.id).set(Object.assign(data.user, {
        active: true,
        createdAt: new Date(),
        lastLogin: new Date(),
        userRole: playerRole,
        foundBoxes: [],
        openedBoxes: [],
        coveredDistance: 0,
        points: 0,
        money: 0,
        coins: 0,
        level: 1
    }));
});

/* exports.markBoxAsFound = functions.https.onCall((data, context) => {
    return new Promise((resolve, reject) => {
        firestore.collection('userProfile').doc(context.auth.uid).get().then(userProfile => {
            return firestore.collection('box').doc(data.id).update({
                foundBy: userProfile.ref,
                foundAt: new Date()
            }).then(() => {
                return geoCollection.doc(data.id).update({ objectType: 4 }).then(() => {
                    return firestore.collection('box').doc(data.id).collection('hints').get().then(hints => {
                        return Promise.all(hints.map(hint => {
                            return geoCollection.doc(hint.id + 'hint').delete();
                        })).then(() => {
                            resolve({ success: true });
                            return;
                        });
                    }).catch(e => {
                        reject(e);
                    });
                }).catch(e => {
                    reject(e);
                });
            }).catch(e => {
                reject(e);
            });
        }).catch(e => {
            reject(e);
        });
    });
}); */

exports.deleteHint = functions.firestore
    .document('box/{uid}/hints/{id}').onDelete(snap => {
        return geoCollection.doc(snap.id + 'hint').delete().then(() => {
            if (snap.data().type === 3) {
                const fileRef = storage.ref().child('boxHintImages/' + snap.id);
                return fileRef.delete();
            }
            return true;
       })
            .catch(e =>  {
                console.error(e);
            });
    });

exports.processImages = functions.storage.object().onFinalize((object) => {
    let newSize;
    if (object.name.startsWith('profileImages')) {
        newSize = '300x300>';
    } else {
        newSize = '600x600>';
    }

    const fileBucket = object.bucket;
    const bucket = storage.bucket(fileBucket);
    const fileName = path.basename(object.name);
    const tempFilePath = path.join(os.tmpdir(), fileName);
    return bucket.file(object.name).getMetadata().then(metaData => {
        if (metaData[0].metadata.isProcessed) {
            return true;
        } else {
            return bucket.file(object.name).download({
                destination: tempFilePath,
            }).then(() => {
                return spawn('convert', [tempFilePath, '-auto-orient', tempFilePath]);
            }).then(() => {
                return spawn('convert', [tempFilePath, '-thumbnail', newSize, tempFilePath]);
            })
                .then(() => {
                    return bucket.upload(tempFilePath, {
                        destination: object.name,
                        metadata: {
                            contentType: object.contentType,
                            metadata: { isProcessed: true }
                        }
                    })
                })
                .then(() => {
                    fs.unlinkSync(tempFilePath);
                    return bucket.file(object.name).setMetadata({
                        metadata: {
                            isProcessed: true
                        }
                    }).catch(e => {
                        console.error(e);
                    });
                });
        }
    }).catch(e => {
        console.error(e);
    });


});
