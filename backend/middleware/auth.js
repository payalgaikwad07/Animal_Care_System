// Use these on routes that need a logged-in user or a specific role.
// Example: router.post('/animals', needLogin, onlyRole('Admin', 'Global Admin'), addAnimal);

function needLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Please log in' });
  }
  next();
}

function onlyRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user || !roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    next();
  };
}

module.exports = { needLogin, onlyRole };