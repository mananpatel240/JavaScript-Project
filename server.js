/*********************************************************************************
* WEB322 – Assignment 06
* I declare that this assignment is my own work in accordance with Seneca Academic Policy. No part of this
* assignment has been copied manually or electronically from any other source (including web sites) or
* distributed to other students.
*
* Name: Manan Patel     Student ID: 148603194      Date: 12-09-2021
*
* Online (Heroku) Link: https://serene-reef-60851.herokuapp.com/
*
********************************************************************************/

const express = require("express");
const path = require("path");
const data = require("./data-service.js");
const bodyParser = require('body-parser');
const fs = require("fs");
const multer = require("multer");
const exphbs = require('express-handlebars');
const app = express();
const dataServiceAuth = require("./data-service-auth.js");
const clientSessions = require("client-sessions");

const HTTP_PORT = process.env.PORT || 8080;

app.engine('.hbs', exphbs({ 
    extname: '.hbs',
    defaultLayout: "main",
    helpers: { 
        navLink: function(url, options){
            return '<li' + 
                ((url == app.locals.activeRoute) ? ' class="active" ' : '') + 
                '><a href="' + url + '">' + options.fn(this) + '</a></li>';
        },
        equal: function (lvalue, rvalue, options) {
            if (arguments.length < 3)
                throw new Error("Handlebars Helper equal needs 2 parameters");
            if (lvalue != rvalue) {
                return options.inverse(this);
            } else {
                return options.fn(this);
            }
        }
    } 
}));

app.set('view engine', '.hbs');

// multer requires a few options to be setup to store files with file extensions
// by default it won't store extensions for security reasons
const storage = multer.diskStorage({
    destination: "./public/images/uploaded",
    filename: function (req, file, cb) {
      // we write the filename as the current date down to the millisecond
      // in a large web service this would possibly cause a problem if two people
      // uploaded an image at the exact same time. A better way would be to use GUID's for filenames.
      // this is a simple example.
      cb(null, Date.now() + path.extname(file.originalname));
    }
  });
  
  // tell multer to use the diskStorage function for naming files instead of the default.
  const upload = multer({ storage: storage });


app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(function(req,res,next){
    let route = req.baseUrl + req.path;
    app.locals.activeRoute = (route == "/") ? "/" : route.replace(/\/$/, "");
    next();
});

app.use(clientSessions( {
    cookieName: "session",
    secret: "web_a6_secret",
    duration: 2*60*1000,
    activeDuration: 1000*60
}));

app.use((req,res,next) => {
    res.locals.session = req.session;
    next();
});

ensureLogin = (req,res,next) => {
    if (!(req.session.user)) {
        res.redirect("/login");
    }
    else { next(); }
};

app.get("/", (req,res) => {
    res.render("home");
});

app.get("/about", (req,res) => {
    res.render("about");
});

app.get("/images/add", ensureLogin, (req,res) => {
    res.render("addImage");
});

app.get("/employees/add", ensureLogin, (req,res) => {

    data.getDepartments().then((data)=>{
        res.render("addEmployee", {departments: data});
     }).catch((err) => {
       // set department list to empty array
       res.render("addEmployee", {departments: [] });
    });
  
  
  });

app.get("/images", ensureLogin, (req,res) => {
    fs.readdir("./public/images/uploaded", function(err, items) {
        res.render("images",{images:items});
    });
});

app.get("/employees",ensureLogin, (req, res) => {
    
   if (req.query.status) {
        data.getEmployeesByStatus(req.query.status).then((data) => {
            res.render("employees", (data.length > 0) ? {employees:data} : { message: "no results" });
        }).catch((err) => {
            res.render("employees",{ message: "no results" });
        });
    } else if (req.query.department) {
        data.getEmployeesByDepartment(req.query.department).then((data) => {
            res.render("employees", (data.length > 0) ? {employees:data} : { message: "no results" });
        }).catch((err) => {
            res.render("employees",{ message: "no results" });
        });
    } else if (req.query.manager) {
        data.getEmployeesByManager(req.query.manager).then((data) => {
            res.render("employees", (data.length > 0) ? {employees:data} : { message: "no results" });
        }).catch((err) => {
            res.render("employees",{ message: "no results" });
        });
    } else {
        data.getAllEmployees().then((data) => {
            res.render("employees", (data.length > 0) ? {employees:data} : { message: "no results" });
        }).catch((err) => {
            res.render("employees",{ message: "no results" });
        });
    }
});

app.get("/employee/:empNum", ensureLogin, (req, res) => {

    // initialize an empty object to store the values
    let viewData = {};

    data.getEmployeeByNum(req.params.empNum).then((data) => {
        if (data) {
            viewData.employee = data; //store employee data in the "viewData" object as "employee"
        } else {
            viewData.employee = null; // set employee to null none were returned
        }
    }).catch(() => {
        viewData.employee = null; // set employee to null if there was an error 
    }).then(data.getDepartments)
    .then((data) => {
        viewData.departments = data; // store department data in the "viewData" object as "departments"

        // loop through viewData.departments and once we have found the departmentId that matches
        // the employee's "department" value, add a "selected" property to the matching 
        // viewData.departments object

        for (let i = 0; i < viewData.departments.length; i++) {
            if (viewData.departments[i].departmentId == viewData.employee.department) {
                viewData.departments[i].selected = true;
            }
        }

    }).catch(() => {
        viewData.departments = []; // set departments to empty if there was an error
    }).then(() => {
        if (viewData.employee == null) { // if no employee - return an error
            res.status(404).send("Employee Not Found");
        } else {
            res.render("employee", { viewData: viewData }); // render the "employee" view
        }
    }).catch((err)=>{
        res.status(500).send("Unable to Show Employees");
      });;
});



app.get("/departments", ensureLogin, (req,res) => {
    data.getDepartments().then((data)=>{
        res.render("departments", (data.length > 0) ? {departments:data} : { message: "no results" });
    }).catch((err) => {
        res.render("departments",{message:"no results"});
    });
});


app.post("/employees/add", ensureLogin, (req, res) => {
    data.addEmployee(req.body).then(()=>{
      res.redirect("/employees"); 
    }).catch((err)=>{
        res.status(500).send("Unable to Add the Employee");
      });
  });

app.post("/images/add", ensureLogin, upload.single("imageFile"), (req,res) =>{
    res.redirect("/images");
});


app.post("/employee/update", ensureLogin, (req, res) => {
    data.updateEmployee(req.body).then(()=>{
    res.redirect("/employees");
  }).catch((err)=>{
    res.status(500).send("Unable to Update the Employee");
  });
  
});

app.get("/departments/add", ensureLogin, (req,res) => {
    res.render("addDepartment");
  });
  
app.post("/departments/add", ensureLogin, (req, res) => {
    data.addDepartment(req.body).then(()=>{
    res.redirect("/departments");
    }).catch((err)=>{
        res.status(500).send("Unable to Add the Department");
    });
});
  

app.post("/department/update", ensureLogin, (req, res) => {
    data.updateDepartment(req.body).then(()=>{
    res.redirect("/departments");
    }).catch((err)=>{
        res.status(500).send("Unable to Update the Department");
    }); 
});
  
app.get("/department/:departmentId", ensureLogin, (req, res) => {
  
    data.getDepartmentById(req.params.departmentId).then((data) => {
        if(data){
            res.render("department", { data: data });
        }else{
            res.status(404).send("Department Not Found");
        }
     
    }).catch((err) => {
      res.status(404).send("Department Not Found");
    });
  
});

app.get("/employees/delete/:empNum", ensureLogin, (req,res)=>{
    data.deleteEmployeeByNum(req.params.empNum).then(()=>{
      res.redirect("/employees");
    }).catch((err)=>{
      res.status(500).send("Unable to Remove Employee / Employee Not Found");
    });
});

app.get("/departments/delete/:depId", ensureLogin, (req,res)=>{
    data.deleteDepartmentById(req.params.depId).then(()=>{
      res.redirect("/departments");
    }).catch((err)=>{
      res.status(500).send("Unable to Remove Department / Department Not Found");
    });
});

app.get("/login", (req,res) => {
    res.render("login");
});

app.get("/register", (req,res) => {
    res.render("register");
});

app.post("/register", (req,res) => {
    dataServiceAuth.registerUser(req.body)
    .then(() => res.render("register", {successMessage: "User created" } ))
    .catch (err => res.render("register", {errorMessage: err, userName:req.body.userName }) )
});

app.post("/login", (req,res) => {
    req.body.userAgent = req.get('User-Agent');
    dataServiceAuth.checkUser(req.body)
    .then(user => {
        req.session.user = {
            userName:user.userName,
            email:user.email,
            loginHistory:user.loginHistory
        }
        res.redirect("/employees");
    })
    .catch(err => {
        res.render("login", {errorMessage:err, userName:req.body.userName} )
    }) 
});

app.get("/logout", (req,res) => {
    req.session.reset();
    res.redirect("/");
});

app.get("/userHistory", ensureLogin, (req,res) => {
    res.render("userHistory", {user:req.session.user} );
});


app.use((req, res) => {
    res.status(404).send('Page not found');
});

data.initialize()
.then(dataServiceAuth.initialize())
.then(() => {
    app.listen(HTTP_PORT)
}).catch (() => {
    console.log('promises unfulfilled');
});