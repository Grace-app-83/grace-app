const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI).then(()=>console.log('Connected to MongoDB!')).catch(err=>console.log(err));

const app = express();
app.use(cors({origin:'*'}));
app.use(express.json());

async function sendEmail(to, subject, html) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Grace App <onboarding@resend.dev>',
      to: [to],
      subject: subject,
      html: html
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data;
}

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

app.post('/forgot-password',async(req,res)=>{
try{
const{email}=req.body;
if(!email)return res.status(400).json({error:'Email is required!'});
const user=await User.findOne({email});
if(!user)return res.status(400).json({error:'No account found with that email!'});
const resetCode=Math.floor(100000+Math.random()*900000).toString();
user.resetCode=resetCode;
user.resetCodeExpiry=new Date(Date.now()+15*60*1000);
await user.save();
await sendEmail(
  email,
  'Your Grace Password Reset Code',
  '<div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:30px;background:#0d0a07;color:#f0e8d8;border-radius:16px;"><h1 style="color:#C9A84C;font-size:32px;text-align:center;">GRACE</h1><p style="text-align:center;color:#a89880;">Your password reset code is:</p><div style="background:#1a1510;border:1px solid #C9A84C;border-radius:12px;padding:20px;text-align:center;margin:20px 0;"><span style="font-size:36px;font-weight:800;color:#E8C97A;letter-spacing:8px;">'+resetCode+'</span></div><p style="color:#a89880;font-size:13px;text-align:center;">This code expires in 15 minutes. If you did not request this, ignore this email.</p></div>'
);
res.json({message:'Reset code sent to your email!'});
}catch(e){console.log(e);res.status(500).json({error:'Could not send email. Try again!'});}
});

app.post('/reset-password',async(req,res)=>{
try{
const{email,code,newPassword}=req.body;
if(!email||!code||!newPassword)return res.status(400).json({error:'All fields required!'});
const user=await User.findOne({email});
if(!user)return res.status(400).json({error:'No account found!'});
if(user.resetCode!==code)return res.status(400).json({error:'Invalid reset code!'});
if(new Date()>user.resetCodeExpiry)return res.status(400).json({error:'Reset code has expired!'});
user.password=newPassword;
user.resetCode=undefined;
user.resetCodeExpiry=undefined;
await user.save();
res.json({message:'Password reset successfully!'});
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
