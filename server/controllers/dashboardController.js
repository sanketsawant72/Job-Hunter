/**
 * Dashboard Controller
 */
const mongoose    = require('mongoose');
const Recruiter   = require('../models/Recruiter');
const Application = require('../models/Application');
const Draft       = require('../models/Draft');

// @desc   Get dashboard stats
// @route  GET /api/dashboard
exports.getDashboard = async (req, res, next) => {
  try {
    // Always use ObjectId for aggregation pipelines — string userId
    // causes $match to silently return 0 results in aggregations.
    const userId   = new mongoose.Types.ObjectId(req.user.id);
    const now      = new Date();
    const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo  = new Date(today.getTime() - 7  * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalRecruiters,
      recruitersByStatus,
      totalDrafts,
      totalSent,
      totalReplied,
      totalFailed,
      todayApps,
      weekApps,
      monthApps,
      recentApplications,
      weeklyRaw,
    ] = await Promise.all([
      Recruiter.countDocuments({ user: req.user.id }),

      Recruiter.aggregate([
        { $match: { user: userId } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),

      Draft.countDocuments({ user: req.user.id }),

      Application.countDocuments({ user: req.user.id, status: 'sent' }),
      Application.countDocuments({ user: req.user.id, status: 'replied' }),
      Application.countDocuments({ user: req.user.id, status: 'failed' }),

      Application.countDocuments({ user: req.user.id, sentAt: { $gte: today } }),
      Application.countDocuments({ user: req.user.id, sentAt: { $gte: weekAgo } }),
      Application.countDocuments({ user: req.user.id, sentAt: { $gte: monthAgo } }),

      Application.find({ user: req.user.id })
        .sort({ sentAt: -1 })
        .limit(5)
        .select('recruiterName company recruiterEmail status sentAt subject'),

      // Daily counts for the last 7 days
      Application.aggregate([
        { $match: { user: userId, sentAt: { $gte: weekAgo } } },
        {
          $group: {
            _id:   { $dateToString: { format: '%Y-%m-%d', date: '$sentAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),
    ]);

    // Convert recruitersByStatus array → plain object
    const statusMap = {};
    recruitersByStatus.forEach(s => { statusMap[s._id] = s.count; });

    // Fill every day in the last 7 days — even days with 0 applications
    const weeklyChart = fillDays(weeklyRaw, 7);

    // Application status breakdown (for doughnut)
    const appStatusAgg = await Application.aggregate([
      { $match: { user: userId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const appStatusMap = {};
    appStatusAgg.forEach(s => { appStatusMap[s._id] = s.count; });

    res.json({
      success: true,
      data: {
        stats: {
          totalRecruiters,
          emailsGenerated: totalDrafts,
          drafts:          totalDrafts,
          emailsSent:      totalSent,
          replies:         totalReplied,
          failed:          totalFailed,
          todayApplications: todayApps,
          weekApplications:  weekApps,
          monthApplications: monthApps,
        },
        recruiterStatus: {
          new:      statusMap.new      || 0,
          drafted:  statusMap.drafted  || 0,
          sent:     statusMap.sent     || 0,
          replied:  statusMap.replied  || 0,
          rejected: statusMap.rejected || 0,
        },
        appStatus: {
          sent:     appStatusMap.sent     || 0,
          replied:  appStatusMap.replied  || 0,
          rejected: appStatusMap.rejected || 0,
          failed:   appStatusMap.failed   || 0,
        },
        recentApplications,
        charts: {
          weekly: weeklyChart,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fill every calendar day for the last `days` days.
 * Days with no applications get count: 0.
 */
function fillDays(raw, days) {
  const map = {};
  raw.forEach(d => { map[d._id] = d.count; });

  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d   = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];  // 'YYYY-MM-DD'
    result.push({ date: key, count: map[key] || 0 });
  }
  return result;
}
