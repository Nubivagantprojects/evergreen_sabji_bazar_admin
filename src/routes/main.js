const express = require("express");
const multer = require("multer");
const { route } = require("express/lib/application");
const { initializeApp } = require("firebase/app");
const { getAuth, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } = require("firebase/auth");
const { LocalStorage } = require('node-localstorage');
const localStorage = new LocalStorage('./scratch');
const routes = express.Router();

var admin = require("firebase-admin");

var serviceAccount = require("../../key.json");
const { json } = require("body-parser");

// Initialize Firebase
const app = initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "gs://evergreen-sabji-bazar.appspot.com",
  apiKey: "AIzaSyDjjy9okA4zLvDhXlVgV2JnNVEWh0n0q3Q"
});
const auth = getAuth(app);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "gs://evergreen-sabji-bazar.appspot.com"
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const filesave = multer.memoryStorage();
const upload = multer({ storage: filesave });

routes.get("/", async (req, res) => {
  res.redirect("/admin_main/admin_login");
});
routes.get("/admin_main/admin_login", (req, res) => {
  res.render("admin_main/admin_login"); // Adjust the path to match the file location
});
routes.post("/admin_main/admin_login", async (req, res) => {
  const { userlogname, userlogpass } = req.body;

  // Validate the login credentials
  if (userlogname === "sabji@gmail.com" && userlogpass === "sabji@0987") {
    // If credentials are correct, redirect to the product view page
    res.redirect("/admin_main/product_view");
  } else {
    // If credentials are incorrect, redirect back to the login page with an error message
    res.redirect("/admin_main/admin_login?error=invalid_credentials");
  }
});

routes.post("/search", async (req, res) => {
  const searchQuery = req.body.search;
  if (searchQuery) {
    var cat_array = [];
    var item_array = [];
    const user_json = localStorage.getItem('user');
    const user_obj = JSON.parse(user_json);
    // console.log(user_obj)
    await db
      .collection("category")
      .get()
      .then((snapshot) => {
        snapshot.forEach((element) => {
          cat_array.push(element.data());
        });
      });
    await db
      .collection("item")
      .get()
      .then((snapshot) => {
        snapshot.forEach((element) => {
          item_array.push(element.data());
        });
      });

    const results = [];
    item_array.forEach((item) => {
      const nameMatch = item.item_name.toLowerCase().includes(searchQuery.toLowerCase());
      const tags = Object.keys(item).filter(key => key.startsWith('tag_')).map(key => item[key]);
      const tagMatch = tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      if (nameMatch || tagMatch) {
        results.push({ id: item.id, ...item });
      }
    });

    // const user = "vishwakarmaanjan@gmail.com";
    let cart_items = [];
    let count_cart;
    if (user_obj == null) {
      count_cart = 0;
    }
    else {
      const user = user_obj?.email;
      await db
        .collection("cart")
        .where("user", "==", user)
        .where("isC", "==", "1")
        .get()
        .then((snapshot) => {
          snapshot.forEach((element) => {
            cart_items.push(element.data());
          });
        });
      count_cart = cart_items.length;
    }
    // console.log(user_obj)
    await db
      .collection("Banners")
      .doc("images")
      .get()
      .then(doc => {
        res.render("user_main/search", { cate: cat_array, banner: doc.data(), items: results, count: count_cart, user: user_obj });
      });
  }
  else{
    res.redirect("/");
  }

});
routes.post("/profileUP", async (req, res) => {
  const {fname,contact,country,district,pin,state,address} = req.body;
  console.log(req.body)
  if (address || state || pin || district || country || contact ||fname) {
    // console.log(user_obj)
    await db.collection("user").doc(req.query.user).update({
      'state': state,
      'pin': pin,
      'phone': contact,
      'dist': district,
      'country': country,
      'add1': address,
      'customername': fname,
    })
    res.redirect("/my-profile.html");
  }
  else{
    res.redirect("/my-profile.html");
  }

});
routes.post("/addressUP", async (req, res) => {
  const {country,district,pin,state,add1,add2} = req.body;
  console.log(req.body)
  if (add1 || state || pin || district || country || add2) {
    // console.log(user_obj)
    await db.collection("user").doc(req.query.user).update({
      'state': state,
      'pin': pin,
      'dist': district,
      'country': country,
      'add1': add1,
      'add2': add2,
    })
    res.redirect("/my-address.html");
  }
  else{
    res.redirect("/my-address.html");
  }
});

routes.post("/loginUA", async (req, res) => {
  // console.log(req.body)
  if (req.body.userlogname == "sabji@gmail.com" && req.body.userlogpass == "sabji@0987") {
    res.redirect("/admin_main/product_view");
  }
  else {
    if (req.body.userlogname != "") { //user login mail
      try {
        const userCredential = await signInWithEmailAndPassword(auth, req.body.userlogname, req.body.userlogpass);
        const user = userCredential.user;
        if (user.emailVerified) {
          localStorage.setItem('user', JSON.stringify(user));
          res.redirect("/");
        } else {
          await signOut(auth);
          res.redirect("/");
        }
      } catch (error) {
        console.log(error)
      }
    }
    else if (req.body.usersignemail != "") { //user is doing sign in using mail
      if (req.body.usersignpass != req.body.usersignconf) {
        res.redirect("/");
      }

      const userCredential = await createUserWithEmailAndPassword(auth, req.body.usersignemail, req.body.usersignpass);
      const user = userCredential.user;

      try {
        await sendEmailVerification(user);
        await admin.firestore().collection("user").doc(req.body.usersignemail).set({
          currency: "INR",
          customername: req.body.usersignname,
          email: req.body.usersignemail,
          isD: "0",
          isE: "1",
          location: req.body.address,
          add1: "",
          add2: "",
          dist: "",
          gender: "",
          locality: "",
          pin: "",
          state: "",
          password: req.body.usersignpass,
          phone: req.body.usersignphone
        });
        res.redirect("/");
      } catch (error) {
        console.log(error)
      }

    }
    // console.error("Not a valid admin id");
    // res.redirect("/");
  }
  // await db.collection("category").doc("CT" + Date.now()).set({
  //   'cat_id': "CT" + Date.now(),
  //   'cat_img_url': '',
  //   'cat_name': req.body.cat_name,
  //   'isAvl': '1',
  //   'isD': '0',
  //   'isE': '1'
  // })
});

routes.get("/admin_main/product_view", async (req, res) => {
  var product_array = [];
  await db
    .collection("item")
    .get()
    .then((snapshot) => {
      snapshot.forEach((element) => {
        product_array.push(element.data());
      });
    });
  res.render("admin_main/product_view", { details: product_array });
});

routes.get("/admin_main/product_entry", async (req, res) => {
  var product_array = [];
  await db
    .collection("category")
    .get()
    .then((snapshot) => {
      snapshot.forEach((element) => {
        product_array.push(element.data());
      });
    });
  res.render("admin_main/product_entry", { details: product_array });
});

routes.post("/admin_main/product_entry_submit", upload.fields([{ name: 'item_img', maxCount: 1 }, { name: 'item_img_1', maxCount: 1 }, { name: 'item_img_2', maxCount: 1 }, { name: 'item_img_3', maxCount: 1 }]), async (req, res) => {
  console.log(req.body);
  console.log(req.files);

  const files = req.files;
  let uploadedFiles = [];

  if (!files || Object.keys(files).length === 0) {
    return res.status(400).send('No files uploaded.');
  }

  try {
    const uploadPromises = Object.keys(files).map(async (key) => {
      const file = files[key][0];
      const blob = bucket.file(file.originalname);
      const blobStream = blob.createWriteStream({
        metadata: {
          contentType: file.mimetype,
        },
      });

      await new Promise((resolve, reject) => {
        blobStream.on('error', (err) => reject(err));
        blobStream.on('finish', () => resolve());
        blobStream.end(file.buffer);
      });

      // Generate a signed URL for the uploaded file
      const [url] = await blob.getSignedUrl({
        action: 'read',
        expires: '03-09-2030', // Replace with a suitable expiration date
      });

      return { filename: file.originalname, url };
    });

    uploadedFiles = await Promise.all(uploadPromises);
  }
  catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
  // const
  await db.collection("item").doc("I" + Date.now()).set({
    'id': "I" + Date.now(),
    'item_name': req.body.item_name,
    'item_price': req.body.item_price,
    'item_price_unit': req.body.item_price_unit,
    'item_price_disc': req.body.item_disc,// high price not discounted
    'item_catagory': req.body.item_catagory,
    'item_desc': req.body.item_desc,
    'item_avail': req.body.item_avail,
    'tag_1': req.body.tag_1,
    'tag_2': req.body.tag_2,
    'tag_3': req.body.tag_3,
    'tag_4': req.body.tag_4,
    'tag_5': req.body.tag_5,
    'tag_6': req.body.tag_6,
    'tag_7': req.body.tag_7,
    'tag_8': req.body.tag_8,
    'tag_9': req.body.tag_9,
    'tag_10': req.body.tag_10,
    'item_img': uploadedFiles[0].url,
    'item_img_1': uploadedFiles[1].url,
    'item_img_2': uploadedFiles[2].url,
    'item_img_3': uploadedFiles[3].url,
    'rating': '5',
    'isE': '1',
    'isD': '0',
    'u1': '',
    'u2': '',
    'u3': '',
    'u4': '',
    'u5': ''
  })
  res.redirect("/admin_main/product_view");
});

routes.post("/admin_main/category_entry_submit", upload.single("cat_img"), async (req, res) => {
  console.log(req.body);
  console.log(req.file);
  let fileurl = '';
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  try {
    const blob = bucket.file(req.file.originalname);
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: req.file.mimetype,
      },
    });

    await new Promise((resolve, reject) => {
      blobStream.on('error', (err) => reject(err));
      blobStream.on('finish', () => resolve());
      blobStream.end(req.file.buffer);
    });

    // Generate a signed URL for the uploaded file
    const [url] = await blob.getSignedUrl({
      action: 'read',
      expires: '03-09-2030', // Replace with a suitable expiration date
    });
    fileurl = url;
  } catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
  await db.collection("category").doc("CT" + Date.now()).set({
    'cat_id': "CT" + Date.now(),
    'cat_img_url': fileurl,
    'cat_name': req.body.cat_name,
    'isAvl': '1',
    'isD': '0',
    'isE': '1'
  })
  res.redirect("/admin_main/product_entry");
});

routes.post("/admin_main/transit_entry_submit", async (req, res) => {
  console.log(req.query.id);
  await db.collection("order").doc(req.query.id.toString()).update({
    'ship_partner': req.body.ship_name,
    'track_id': req.body.ship_id,
    'track_url': req.body.ship_url
  })
  res.redirect("/admin_main/in_transit_order");
});

routes.post("/admin_main/product_edit_submit", upload.fields([{ name: 'item_img', maxCount: 1 }, { name: 'item_img_1', maxCount: 1 }, { name: 'item_img_2', maxCount: 1 }, { name: 'item_img_3', maxCount: 1 }]), async (req, res) => {
  console.log(req.query.id);
  const files = req.files;
  let uploadedFiles = [];
  try {
    const uploadPromises = Object.keys(files).map(async (key) => {
      const file = files[key][0];
      const blob = bucket.file(file.originalname);
      const blobStream = blob.createWriteStream({
        metadata: {
          contentType: file.mimetype,
        },
      });

      await new Promise((resolve, reject) => {
        blobStream.on('error', (err) => reject(err));
        blobStream.on('finish', () => resolve());
        blobStream.end(file.buffer);
      });

      // Generate a signed URL for the uploaded file
      const [url] = await blob.getSignedUrl({
        action: 'read',
        expires: '03-09-2030', // Replace with a suitable expiration date
      });

      return { filename: file.originalname, url };
    });

    uploadedFiles = await Promise.all(uploadPromises);
  }
  catch (err) {
    console.error(err);
    res.status(500).send(err.message);
  }
  let image_obj={};
  for (let index = 0; index < uploadedFiles.length; index++) {
    if(index==0){
      image_obj[`item_img`]=uploadedFiles[index].url;
    }
    else{
      image_obj[`item_img_${index}`]=uploadedFiles[index].url;
    }
  }
  await db.collection("item").doc(req.query.id.toString()).update({
    ...image_obj,
    'item_name': req.body.item_name,
    'item_price': req.body.item_price,
    'item_price_unit': req.body.item_price_unit,
    'item_price_disc': req.body.item_disc,// high price not discounted
    'item_catagory': req.body.item_catagory,
    'item_desc': req.body.item_desc,
    'item_avail': req.body.item_avail,
    'tag_1': req.body.tag_1,
    'tag_2': req.body.tag_2,
    'tag_3': req.body.tag_3,
    'tag_4': req.body.tag_4,
    'tag_5': req.body.tag_5,
    'tag_6': req.body.tag_6,
    'tag_7': req.body.tag_7,
    'tag_8': req.body.tag_8,
    'tag_9': req.body.tag_9,
    'tag_10': req.body.tag_10
  })
  res.redirect("/admin_main/product_view");
});

routes.get("/admin_main/cancelled_order", async (req, res) => {

  var product_array = [];
  await db
    .collection("order")
    .where("verification", "==", "2")
    .where("delivery_status", "==", "2")
    .get()
    .then((snapshot) => {
      snapshot.forEach((element) => {
        product_array.push(element.data());
      });
    });
  // res.send("this is message from routes")
  res.render("admin_main/cancelled_order", { 'details': product_array });
});

routes.get("/admin_main/changepassword", (req, res) => {
  // res.send("this is message from routes")
  res.render("admin_main/changepassword");
});

routes.get("/admin_main/delivered_order", async (req, res) => {
  var product_array = [];
  await db
    .collection("order")
    .where("delivery_status", "==", "1")
    .get()
    .then((snapshot) => {
      snapshot.forEach((element) => {
        product_array.push(element.data());
      });
    });
  // res.send("this is message from routes")
  res.render("admin_main/delivered_order", { 'details': product_array });
});

routes.get('/admin_main/deliver', async (request, response) => {
  const id = request.query.id
  console.log(id)
  await db.collection("order").doc(id.toString()).update({
    'delivery_status': "1"
  })
  response.redirect("/admin_main/delivered_order");
});

routes.get('/admin_main/Refund', async (request, response) => {
  const id = request.query.id
  console.log(id)
  // await db.collection("order").doc(id.toString()).update({
  //   'delivery_status': "1"
  // })
  response.redirect("/admin_main/refunded_order");
});


routes.get("/admin_main/detailtransit", async (req, res) => {
  const id = req.query.id
  await db
    .collection("order")
    .doc(id.toString())
    .get()
    .then(doc => {
      console.log(doc.data());
      res.render("admin_main/ship_detail_entry", { 'id': id, details: doc.data() });
    });
});

routes.get("/admin_main/cancel", async (req, res) => {
  const id = req.query.id
  console.log(id)
  await db.collection("order").doc(id.toString()).update({
    "verification": "2",
    "delivery_status": "2"
  })
  res.redirect("/admin_main/cancelled_order");
});

routes.get("/admin_main/order_admin", async (req, res) => {
  var product_array = [];
  await db
    .collection("cart")
    .where("order", "==", req.query.id.toString())
    .where("isC", "==", "0")
    .get()
    .then((snapshot) => {
      snapshot.forEach((element) => {
        product_array.push(element.data());
      });
    });
  // res.send("this is message from routes")
  res.render("admin_main/order_admin_details", { 'details': product_array });
});

routes.get("/admin_main/in_transit_order", async (req, res) => {
  var product_array = [];
  await db
    .collection("order")
    .where("transit_status", "==", "1")
    .where("delivery_status", "==", "0")
    .get()
    .then((snapshot) => {
      snapshot.forEach((element) => {
        product_array.push(element.data());
      });
    });
  // res.send("this is message from routes")
  res.render("admin_main/in_transit_order", { 'details': product_array });
});

routes.get("/admin_main/verified_order", async (req, res) => {
  var product_array = [];
  await db
    .collection("order")
    .where("transit_status", "==", "0")
    .where("delivery_status", "==", "0")
    .where("verification", "==", "1")
    .get()
    .then((snapshot) => {
      snapshot.forEach((element) => {
        product_array.push(element.data());
      });
    });
  res.render("admin_main/verified_order", { details: product_array });
});

routes.get('/admin_main/transit', async (request, response) => {
  const id = request.query.id
  console.log(id)
  await db.collection("order").doc(id.toString()).update({
    'transit_status': "1"
  })
  response.redirect("/admin_main/in_transit_order");
});

routes.get("/item_edit", async (req, res) => {
  const id = req.query.id;
  var cat_array = [];
  await db
    .collection("category")
    .get()
    .then((snapshot) => {
      snapshot.forEach((element) => {
        cat_array.push(element.data());
      });
    });
  await db
    .collection("item")
    .doc(id.toString())
    .get()
    .then(doc => {
      res.render("admin_main/product_edit", { details: doc.data(), categories: cat_array });
    });
});

routes.get("/item_status", async (req, res) => {
  const id = req.query.id;
  const isE = req.query.isE;
  await db.collection("item").doc(id.toString()).update({
    'isE': isE
  })
  console.log(id)
  res.redirect("/admin_main/product_view");
});

module.exports = routes;
