const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
mongoose.connect(process.env.MONGODB_URI).then(()=>console.log('Connected to MongoDB!')).catch(err=>console.log(err));
const app = express();
app.use(cors({origin:'*'}));
app.use(express.json());
app.post('/register',async(req,res)=>{
try{
const{name,email,password,phone}=req.body;
if(!name||!email||!password)return res.status(400).json({error:'Name, email and password are required!'});
const existing=await User.findOne({email});
if(existing)return res.status(400).json({error:'Email already exists!'});
const user=new User({name,email,password,phone:phone||''});
await user.save();
const token=jwt.sign({userId:user._id},process.env.JWT_SECRET,{expiresIn:'30d'});
res.status(201).json({message:'Account created!',token,user:{id:user._id,name:user.name,email:user.email}});
}catch(e){console.log(e);res.status(500).json({error:'Something went wrong!'});}
});
app.post('/login',async(req,res)=>{
try{
const{email,password}=req.body;
if(!email||!password)return res.status(400).json({error:'Email and password required!'});
const user=await User.findOne({email});
if(!user)return res.status(400).json({error:'No account found!'});
const match=await user.comparePassword(password);
if(!match)return res.status(400).json({error:'Incorrect password!'});
const token=jwt.sign({userId:user._id},process.env.JWT_SECRET,{expiresIn:'30d'});
res.json({message:'Login successful!',token,user:{id:user._id,name:user.name,email:user.email}});
}catch(e){res.status(500).json({error:'Something went wrong!'});}
});
app.post('/chat',async(req,res)=>{
const msg=req.body.message;
if(!msg)return res.status(400).json({error:'No message'});
const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:1000,system:'You are Grace, a compassionate Christian AI companion.',messages:[{role:'user',content:msg}]})});
const d=await r.json();
res.json({reply:d.content[0].text});
});
app.listen(3000,()=>console.log('Grace backend running on port 3000'));
