const express = require('express')
const hbs = require("hbs")
const app = express()
const bodyparser = require('body-parser')
const port = 5557
const routes = require('./src/routes/main');


app.use(express.json());       
app.use(express.urlencoded({extended: true})); 
// app.use(bodyparser.urlencoded({ extended:true }))

//static config
app.use('/static', express.static("public"))

//route config
app.use('', routes)

//template engine

app.set('view engine', 'hbs')
app.set("views","views")

hbs.registerHelper("ifs", function (p, q, options) {
  return p == q ? options.fn(this) : options.inverse(this);
});

// app.listen();

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})