import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5000; // Default port
const mongodb_url = process.env.MONGODB_URL;

// Middleware
app.use(cors());
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// Database Connection
mongoose.connect(mongodb_url, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.log("Error connecting to MongoDB: " + error));

// API Routes
app.get("/", (req, res) => {
  res.send("Express app is running");
});

//Image storage engine 

const storage=multer.diskStorage({
    destination:"./upload/images",
    filename:(req,file,cb)=>{
        return cb(null,`${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
})
const upload = multer({storage:storage})

//creating endpoint for uploading images
app.use('/images',express.static('upload/images'))
app.post("/upload",upload.single('product'),(req,res)=>{

    res.json({
       success :1,
       image_url: `http://localhost:${port}/images/${req.file.filename}`
    })
})
//Schema for creating products

const Product = mongoose.model("Product",{
  id: {
    type:Number,
    required:true
  },
  name:{
    type:String,
    required:true,
  },
  image:{
    type:String,
    required:true
  },
  category:{
    type:String,
    
  },
  new_price:{
    type:Number,
    required:true,
  },
  old_price:{
    type:Number,
    required: true,
  },
  date:{
    type:Date,
    default: Date.now,
  },
  available:{
    type:Boolean,
    default:true
  }
})

app.post('/addproduct',async (req,res)=>{
  let products = await Product.find({});
  let id;
  if(products.length>0){
    let last_product_array = products.slice(-1);
    let last_product = last_product_array[0];
    id = last_product.id+1;
  }
  else{
    id=1;
  }
      const product = new Product({
        id: id,
        name: req.body.name,
        image:req.body.image,
        category:req.body.category,
        new_price:req.body.new_price,
        old_price:req.body.old_price,

      });
      console.log(product);
      //db on another continent
      await product.save();
      console.log("Saved");
      res.json({
        sucess:true,
        name:req.body.name,
      })
})

// creating API endpoint for deleting products

app.post('/removeproduct',async(req,res)=>{
        await Product.findOneAndDelete({id:req.body.id});
        console.log("Remove");
        res.json({
          success: true,
          name:req.body.name
        })
})
// Creating API fro getting all products
app.get('/allproducts',async (req,res)=>{
    let products =  await Product.find({});
    console.log("All Products Fetched");
    res.send(products);
}) 

// Schema creating for user model

const Users = mongoose.model('User',{
  name:{
    type:String,
  },
  email:{
    type:String,
    unique:true,
  },
  password:{
    type:String,
  },
  cartData:{
    type:Object,
  },
  date:{
    type:Date,
    default:Date.now,
  }
})

//creating Endpoint for registering the User

app.post('/signup',async (req,res)=>{


  let check = await Users.findOne({email:req.body.email});
 if(check){
     return res.status(400).json({success:false, errors:"existing user found with same user id"})
 }
 //if no user we will create an empty cart
 let cart={};
 for (let i = 0; i < 300; i++) {
  cart[i]=0;
  } 
 const user=new Users({
  name:req.body.username,
  email:req.body.email,
  password:req.body.password,
  cartData:cart,
 })

 await user.save();

 const data= {
    user:{
      id:user.id
    }
 }
 //tokens are for user authentication 
 //jwt is used for user authentication whether it is allowed to use the application or not
 //Authorisation meaning what different parts it is allowed to use
 const token = jwt.sign(data,'secret_ecom');
 res.json({success:true,token})
})

//creating endpoint for user login
app.post('/login',async (req,res)=>{
  let user= await Users.findOne({email:req.body.email})
  if(user){
    const passCompare = req.body.password === user.password;
    if(passCompare){
      const data = {
        user:{
            id:user.id
        }
      }
      const token = jwt.sign(data,'secret_ecom');
      res.json({success:true,token})
    }
    else{
      res.json({success:false,errors:"Wrong Passsword"});
    }
  }
  else{
    res.json({success:false,errors:"Wrong Email Id"})
  }
})

//creating endpoint for newcollection data
app.get('/newcollections',async (req,res)=>{
     let products= await Product.find({});
     let newcollection = products.slice(1).slice(-8)
     //using this method we can get newly added 8 products
     console.log("NewCollections Fetched");
     res.send(newcollection);
})
//creating endpoint for popular in women section
app.get('/popularinwomen', async (req,res)=>{
      let products= await Product.find({category:"women"});
      let popular_in_women = products.slice(0,4);
      console.log("Popular in women fetched");
      res.send(popular_in_women);
})
//creating middleware to fetch user
const fetchUser= async(req,res,next)=>{
  const token=req.header('auth-token');
  if(!token){
    res.status(401).send({errors:"Please authenticate using valid token"})

  }
  else{
    try{
      const data = jwt.verify(token,'secret_ecom');
      req.user=data.user;
      next()
    } catch(error){
        res.status(401).send({errors:"please authenticate using a valid token"})
    }
  }
}
//creating endpoint for adding products in cartdata
app.post('/addtocart',fetchUser,async (req,res)=>{
  console.log("Added",req.body.itemId);
    let userData= await Users.findOne({_id:req.user.id});
    userData.cartData[req.body.itemId]+=1;
    await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData})
    res.send("Added")
})
//creating endpoint to remove the product from cart data
app.post('/removefromcart',fetchUser,async (req,res)=>{
  console.log("removed",req.body.itemId);
  let userData= await Users.findOne({_id:req.user.id});
  if( userData.cartData[req.body.itemId]>0)
  userData.cartData[req.body.itemId]-=1;
  await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData})
  res.send("Added")
})
//creating endpoint to get cart data
app.post('/getcart',fetchUser,async (req,res)=>{
  console.log("GetCart");
  let userData= await Users.findOne({_id:req.user.id});
  res.json((userData.cartData));
})

// Start Server
app.listen(port, (error) => {
  if (!error) {
    console.log("Server running on port " + port);
  } else {
    console.log("Error: " + error);
  }
});
