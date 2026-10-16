/**
 * Application History Controller
 */
const Application = require('../models/Application');
const Draft = require('../models/Draft');
const xlsx = require('xlsx');
const { paginate, paginationMeta } = require('../utils/helpers');

// @desc   Get all applications
// @route  GET /api/applications
exports.getApplications = async (req, res, next) => {
  try {
    const { search, status, page = 1, limit = 10, from, to } = req.query;
    const query = { user: req.user.id };

    if (search) {
      query.$or = [
        { recruiterName: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { recruiterEmail: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) query.status = status;
    if (from || to) {
      query.sentAt = {};
      if (from) query.sentAt.$gte = new Date(from);
      if (to) query.sentAt.$lte = new Date(to);
    }

    const { skip, limit: lim } = paginate(query, page, limit);
    const total = await Application.countDocuments(query);
    const applications = await Application.find(query)
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(lim)
      .populate('recruiter', 'name company email status tags');

    res.json({
      success: true,
      data: applications,
      pagination: paginationMeta(total, page, lim)
    });
  } catch (error) {
    next(error);
  }
};

// @desc   Get single application
// @route  GET /api/applications/:id
exports.getApplication = async (req, res, next) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, user: req.user.id })
      .populate('recruiter', 'name company email linkedin location tags')
      .populate('draft', 'subject body signature gmailDraftId');

    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
    res.json({ success: true, data: application });
  } catch (error) {
    next(error);
  }
};

// @desc   Update application status
// @route  PUT /api/applications/:id
exports.updateApplication = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const update = {};
    if (status) {
      update.status = status;
      if (status === 'replied') update.repliedAt = new Date();
    }
    if (notes !== undefined) update.notes = notes;

    const application = await Application.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      {
        ...update,
        $push: {
          timeline: {
            event: `Status updated to ${status}`,
            timestamp: new Date(),
            details: notes || ''
          }
        }
      },
      { new: true }
    );

    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
    res.json({ success: true, data: application });
  } catch (error) {
    next(error);
  }
};

// @desc   Export applications as CSV/Excel
// @route  GET /api/applications/export
exports.exportApplications = async (req, res, next) => {
  try {
    const { format = 'xlsx' } = req.query;
    const applications = await Application.find({ user: req.user.id }).sort({ sentAt: -1 });

    const data = applications.map(a => ({
      'Recruiter Name': a.recruiterName,
      'Company': a.company,
      'Email': a.recruiterEmail,
      'Subject': a.subject,
      'Status': a.status,
      'Sent At': a.sentAt ? a.sentAt.toISOString() : '',
      'Replied At': a.repliedAt ? a.repliedAt.toISOString() : '',
      'Gmail Message ID': a.gmailMessageId || '',
      'Notes': a.notes || ''
    }));

    if (format === 'csv') {
      const ws = xlsx.utils.json_to_sheet(data);
      const csv = xlsx.utils.sheet_to_csv(ws);
      res.setHeader('Content-Disposition', 'attachment; filename=applications.csv');
      res.setHeader('Content-Type', 'text/csv');
      return res.send(csv);
    }

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Applications');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename=applications.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

// @desc   Get all drafts
// @route  GET /api/drafts
exports.getDrafts = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = { user: req.user.id };
    if (status) query.status = status;

    const { skip, limit: lim } = paginate(query, page, limit);
    const total = await Draft.countDocuments(query);
    const drafts = await Draft.find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(lim)
      .populate('recruiter', 'name company email role');

    res.json({ success: true, data: drafts, pagination: paginationMeta(total, page, lim) });
  } catch (error) {
    next(error);
  }
};
