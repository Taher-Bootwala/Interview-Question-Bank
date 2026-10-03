const express = require('express');
const router = express.Router();
const skillController = require('../controllers/skillController');
const { isAdmin } = require('../middleware/auth');

router.get('/', skillController.getSkills);
router.post('/', isAdmin, skillController.createSkill);
router.put('/:id', isAdmin, skillController.updateSkill);
router.delete('/:id', isAdmin, skillController.deleteSkill);

module.exports = router;
