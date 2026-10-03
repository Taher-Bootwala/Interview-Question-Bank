const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const { isAdmin } = require('../middleware/auth');

router.get('/', roleController.getRoles);
router.post('/', isAdmin, roleController.createRole);
router.put('/:id', isAdmin, roleController.updateRole);
router.delete('/:id', isAdmin, roleController.deleteRole);

module.exports = router;
