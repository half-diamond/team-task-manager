const { validationResult } = require('express-validator');
const Task = require('../models/Task');
const Project = require('../models/Project');

const findProject = (projectId) => Project.findById(projectId).populate('members.user', 'name email');

const idOf = (doc) => doc?._id || doc;

const sameId = (left, right) => {
  const leftId = idOf(left);
  const rightId = idOf(right);
  return Boolean(leftId && rightId && leftId.toString() === rightId.toString());
};

const memberId = (member) => idOf(member.user);

const hasProjectAccess = (project, userId) =>
  project.members.some((member) => sameId(memberId(member), userId));

const isProjectAdmin = (project, userId) =>
  project.members.some((member) => sameId(memberId(member), userId) && member.role === 'Admin');

exports.listTasks = async (req, res, next) => {
  try {
    const project = await findProject(req.params.projectId);
    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }
    if (!hasProjectAccess(project, req.user._id)) {
      res.status(403);
      throw new Error('Not allowed');
    }

    const taskQuery = { project: project._id };
    if (!isProjectAdmin(project, req.user._id)) {
      taskQuery.assignedTo = req.user._id;
    }

    const tasks = await Task.find(taskQuery)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ tasks });
  } catch (error) {
    next(error);
  }
};

exports.createTask = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400);
      throw new Error(errors.array().map((e) => e.msg).join(', '));
    }

    const project = await findProject(req.params.projectId);
    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }
    if (!isProjectAdmin(project, req.user._id)) {
      res.status(403);
      throw new Error('Only admins can create tasks');
    }

    const { title, description, dueDate, priority, assignedTo } = req.body;

    if (assignedTo && !hasProjectAccess(project, assignedTo)) {
      res.status(400);
      throw new Error('Assigned user is not a project member');
    }

    const task = await Task.create({
      project: project._id,
      title,
      description,
      dueDate: dueDate || null,
      priority,
      assignedTo: assignedTo || null,
      createdBy: req.user._id
    });

    const populated = await Task.findById(task._id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email');

    res.status(201).json({ task: populated });
  } catch (error) {
    next(error);
  }
};

exports.updateTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      res.status(404);
      throw new Error('Task not found');
    }

    const project = await findProject(task.project);
    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }

    const admin = isProjectAdmin(project, req.user._id);
    const isAssignee = sameId(task.assignedTo, req.user._id);

    if (!admin && !isAssignee) {
      res.status(403);
      throw new Error('Not allowed');
    }

    const { title, description, dueDate, priority, status, assignedTo } = req.body;

    if (!admin) {
      const adminOnlyFields = ['title', 'description', 'dueDate', 'priority', 'assignedTo'].filter(
        (field) => req.body[field] !== undefined
      );
      if (adminOnlyFields.length) {
        res.status(403);
        throw new Error('Only admins can manage task details');
      }
      if (status !== undefined) task.status = status;
    } else {
      if (title !== undefined) task.title = title;
      if (description !== undefined) task.description = description;
      if (dueDate !== undefined) task.dueDate = dueDate || null;
      if (priority !== undefined) task.priority = priority;
      if (status !== undefined) task.status = status;
    }

    if (assignedTo !== undefined) {
      if (!admin) {
        res.status(403);
        throw new Error('Only admins can reassign tasks');
      }
      if (assignedTo && !hasProjectAccess(project, assignedTo)) {
        res.status(400);
        throw new Error('Assigned user is not a project member');
      }
      task.assignedTo = assignedTo || null;
    }

    await task.save();

    const populated = await Task.findById(task._id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email');

    res.json({ task: populated });
  } catch (error) {
    next(error);
  }
};

exports.assignTask = async (req, res, next) => {
  try {
    const { assignedTo } = req.body;
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      res.status(404);
      throw new Error('Task not found');
    }

    const project = await findProject(task.project);
    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }
    if (!isProjectAdmin(project, req.user._id)) {
      res.status(403);
      throw new Error('Only admins can assign tasks');
    }
    if (assignedTo && !hasProjectAccess(project, assignedTo)) {
      res.status(400);
      throw new Error('Assigned user is not a project member');
    }

    task.assignedTo = assignedTo || null;
    await task.save();

    const populated = await Task.findById(task._id)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email');

    res.json({ task: populated });
  } catch (error) {
    next(error);
  }
};

exports.deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      res.status(404);
      throw new Error('Task not found');
    }

    const project = await findProject(task.project);
    if (!project) {
      res.status(404);
      throw new Error('Project not found');
    }
    if (!isProjectAdmin(project, req.user._id)) {
      res.status(403);
      throw new Error('Only admins can delete tasks');
    }

    await task.deleteOne();
    res.json({ message: 'Task deleted' });
  } catch (error) {
    next(error);
  }
};
