const app = require('./app');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  Interview Practice Question Bank Server is running!  `);
    console.log(`  URL: http://localhost:${PORT}                        `);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`=======================================================`);
});
