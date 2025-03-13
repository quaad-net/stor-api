import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const userSchema = new Schema({
    email: {
        type: String,
        required: [true, "Please provide an Email!"],
        unique: [true, "Email Exist"],
        lowercase: true,
      },
    
      password: {
        type: String,
        required: [true, "Please provide a password!"],
        unique: false,
      },

      institution: {
        type: String,
        required: [true, "Please provide an institution!"],
        unique: false,
        lowercase: true
      },

      firstName: {
        type: String,
        required: [true, "Please provide a first Name!"],
        unique: false,
        lowercase: true
      },

      lastName: {
        type: String,
        required: [true, "Please provide a last name!"],
        unique: false,
        lowercase: true
      },

      employeeID: { // "_" will be added to employeeID in DB.
        type: String,
        required: [true, "Please provide an employee ID!"],
        unique: false
      },

      trade: {
        type: String,
        required: false,
        unique: false
      },

      position: {
        type: String,
        required: false,
        unique: false
      },

      createdAt: {
        type: Date,
        default: () => Date.now(),
        immutable: true,
      }
});

const User = model('User', userSchema, 'users'); // note uppercasing and none puralization for schema name
export default User;