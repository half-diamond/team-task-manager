const { validationResult } = require('express-validator');
const Project = require('../models/Project');
const User = require('../models/User');

const ALLOWED_ROLES = ['Admin', 'Member'];

const idOf = (doc) => doc?._id || doc;

const sameId = (left, right) => {
  const leftId = idOf(left);
  const rightId = idOf(right);
  return Boolean(leftId && rightId && leftId.toString() === rightId.toString());
};

const memberId = (member) => idOf(member.user);

const hasMember = (project, userId) =>
  project.members.some((member) => sameId(memberId(member), userId));

const isProjectAdmin = (project, userId) =>
  project.members.some((member) => sameId(memberId(member), userId) && member.role === 'Admin');

exports.listProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({ 'members.user': req.user._id })
      .populate('createdBy', 'name email')
      .populate('members.user', 'name email')
      .sort({ createdAt: -1 });
    res.json({ projects });
  } catch (error) {
    next(error);
  }
};

exports.createProject = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400);
      throw new Error(errors.array().map((e) => e.msg).join(', '));
    }

    const { name, description } = req.body;
    const project = await Project.create({
      name,
      description,
      createdBy: req.user._id,
      members: [{ user: req.user._id, role: 'Admin' }]
    });

    const populated = await Project.findById(project._id)
      .populate('createdBy', 'name email')
      .populate('members.user', 'name email');

    res.status(201).json({ project: populated });
  } catch (error) {
    next(error);
  }
};

exports.getProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('members.user', 'name email');

    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }

    if (!hasMember(project, req.user._id)) {
      res.status(403);
      throw new Error('Not allowed');
    }

    res.json({ project });
  } catch (error) {
    next(error);
  }
};

exports.addMember = async (req, res, next) => {
  try {
    const { email, role = 'Member' } = req.body;
    if (!email) {
      res.status(400);
      throw new Error('Email is required');
    }
    if (!ALLOWED_ROLES.includes(role)) {
      res.status(400);
      throw new Error('Invalid member role');
    }

    const project = await Project.findById(req.params.id);
    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }
    if (!isProjectAdmin(project, req.user._id)) {
      res.status(403);
      throw new Error('Only admins can add members');
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    const already = project.members.some((member) => sameId(memberId(member), user._id));
    if (already) {
      res.status(400);
      throw new Error('User already in project');
    }

    project.members.push({ user: user._id, role });
    await project.save();

    const populated = await Project.findById(project._id)
      .populate('createdBy', 'name email')
      .populate('members.user', 'name email');

    res.json({ project: populated });
  } catch (error) {
    next(error);
  }
};

exports.removeMember = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }
    if (!isProjectAdmin(project, req.user._id)) {
      res.status(403);
      throw new Error('Only admins can remove members');
    }

    if (sameId(project.createdBy, req.params.userId)) {
      res.status(400);
      throw new Error('Cannot remove the project creator');
    }

    const beforeCount = project.members.length;
    project.members = project.members.filter((member) => !sameId(memberId(member), req.params.userId));
    if (project.members.length === beforeCount) {
      res.status(404);
      throw new Error('Member not found in project');
    }
    await project.save();

    const populated = await Project.findById(project._id)
      .populate('createdBy', 'name email')
      .populate('members.user', 'name email');

    res.json({ project: populated });
  } catch (error) {
    next(error);
  }
};
