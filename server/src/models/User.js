import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 254,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    unique: true,
  },
  // The authentication service will hash passwords before storing them in Step 3.
  passwordHash: {
    type: String,
    required: true,
    select: false,
    match: /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/,
  },
  role: { type: String, required: true, enum: ['user', 'admin'], default: 'user' },
}, {
  timestamps: true,
  toJSON: {
    transform(_document, result) {
      delete result.passwordHash;
      return result;
    },
  },
});

export const User = mongoose.model('User', userSchema);
