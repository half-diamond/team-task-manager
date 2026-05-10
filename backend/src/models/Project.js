const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['Admin', 'Member'],
      default: 'Member'
    }
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    members: [memberSchema]
  },
  { timestamps: true }
);

projectSchema.pre('validate', function ensureCreatorAdmin(next) {
  if (!this.createdBy) return next();

  const creatorId = this.createdBy?._id || this.createdBy;
  if (!creatorId) return next();

  const creatorMember = this.members.find(
    (member) => {
      const memberId = member.user?._id || member.user;
      return memberId && memberId.toString() === creatorId.toString();
    }
  );

  if (creatorMember) {
    creatorMember.role = 'Admin';
  } else {
    this.members.unshift({ user: this.createdBy, role: 'Admin' });
  }

  next();
});

projectSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Project', projectSchema);
