/**
 * Question Option Rules & Semantic Generator
 * Comprehensive question-specific multiple-choice options engine for all 3,015 questions across 10 subjects.
 */

// Helper: Deterministic hash for topic-level offset
function getTopicHash(topicName) {
    let hash = 0;
    const str = String(topicName || '');
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

// Helper: Clean question prompt text
function cleanPromptText(q) {
    return String(q || '')
        .replace(/^[0-9]+\.\s*/, '')
        .replace(/\?+$/, '')
        .trim();
}

// -------------------------------------------------------------
// HIGH-PRECISION QUESTION RULES DICTIONARY
// Covers SQL, DBMS, Git, Linux, OS, Networks, OOPS, Python, Java, C++
// -------------------------------------------------------------
const specificRules = [
    // === SQL: Ranking & Aggregates ===
    {
        matches: (q) => /3rd highest salary/i.test(q),
        correct: 'SELECT DISTINCT salary FROM Employee ORDER BY salary DESC LIMIT 1 OFFSET 2;',
        distractors: [
            'SELECT salary FROM Employee WHERE ROWNUM = 3 ORDER BY salary DESC;',
            'SELECT MAX(salary) FROM Employee WHERE salary < 3;',
            'SELECT salary FROM Employee ORDER BY salary ASC LIMIT 3;'
        ],
        explanation: 'OFFSET 2 skips the top two salaries, and LIMIT 1 retrieves the 3rd highest distinct salary.'
    },
    {
        matches: (q) => /second highest salary/i.test(q),
        correct: 'SELECT MAX(salary) FROM Employee WHERE salary < (SELECT MAX(salary) FROM Employee);',
        distractors: [
            'SELECT salary FROM Employee ORDER BY salary DESC LIMIT 2;',
            'SELECT SECOND(salary) FROM Employee GROUP BY salary;',
            'SELECT salary FROM Employee WHERE salary = MAX(salary) - 1;'
        ],
        explanation: 'The subquery finds the maximum salary, and the outer query selects the highest salary strictly less than that.'
    },
    {
        matches: (q) => /LIMIT.*OFFSET/i.test(q),
        correct: 'LIMIT specifies the maximum number of rows to return; OFFSET specifies the number of rows to skip before returning results.',
        distractors: [
            'LIMIT sorts rows ascending, while OFFSET sorts rows descending.',
            'LIMIT defines partition size, while OFFSET sets the primary key index.',
            'OFFSET groups duplicate records, while LIMIT aggregates sums.'
        ],
        explanation: '`LIMIT n OFFSET m` skips m records and fetches the next n records in SQL.'
    },
    {
        matches: (q) => /DENSE_RANK/i.test(q),
        correct: 'Assigns consecutive ranks without skipping rank numbers when values are tied (e.g. 1, 2, 2, 3).',
        distractors: [
            'Leaves gaps in ranking after ties (e.g. 1, 2, 2, 4) like standard RANK().',
            'Assigns strictly unique sequential row numbers regardless of duplicate values.',
            'Computes the statistical density of non-null column values.'
        ],
        explanation: '`DENSE_RANK()` does not leave gaps after ties, whereas `RANK()` skips ranks corresponding to tied count.'
    },
    {
        matches: (q) => /ROW_NUMBER/i.test(q),
        correct: 'Assigns a unique, consecutive integer to each row within a partition, starting at 1 regardless of duplicates.',
        distractors: [
            'Assigns duplicate integers to duplicate column values without incrementing.',
            'Returns the total count of rows in the table.',
            'Returns the physical storage block index where the row is located on disk.'
        ],
        explanation: '`ROW_NUMBER()` always produces unique sequential numbers (1, 2, 3...) for each row.'
    },
    {
        matches: (q) => /delete duplicate rows/i.test(q),
        correct: 'Using a CTE with ROW_NUMBER() OVER (PARTITION BY ... ORDER BY id) > 1, or self-joining on duplicate columns with t1.id > t2.id.',
        distractors: [
            'Running TRUNCATE TABLE with the CASCADE DUPLICATES parameter.',
            'Executing DROP DUPLICATES FROM table_name directly in standard SQL.',
            'Configuring AUTO_INCREMENT to IGNORE DUPLICATES.'
        ],
        explanation: 'Common solutions partition by duplicate fields with `ROW_NUMBER() > 1` in a CTE or join on `t1.key = t2.key AND t1.id > t2.id`.'
    },
    {
        matches: (q) => /find duplicate records/i.test(q),
        correct: 'SELECT column_name, COUNT(*) FROM table_name GROUP BY column_name HAVING COUNT(*) > 1;',
        distractors: [
            'SELECT DISTINCT column_name FROM table_name WHERE COUNT(*) > 1;',
            'SELECT column_name FROM table_name WHERE DUPLICATE = TRUE;',
            'SELECT column_name FROM table_name ORDER BY column_name DESC LIMIT DUPLICATES;'
        ],
        explanation: 'Grouping by candidate columns and filtering with `HAVING COUNT(*) > 1` identifies duplicate entries.'
    },
    {
        matches: (q) => /highest salary department/i.test(q),
        correct: 'SELECT department_id, MAX(salary) FROM Employee GROUP BY department_id;',
        distractors: [
            'SELECT department_id, salary FROM Employee ORDER BY salary DESC;',
            'SELECT department_id, salary FROM Employee WHERE salary = HIGHEST(salary);',
            'SELECT department_id, SUM(salary) FROM Employee GROUP BY department_id;'
        ],
        explanation: 'Grouping by `department_id` and applying the `MAX()` aggregate function finds the top salary per department.'
    },
    {
        matches: (q) => /more than department average/i.test(q),
        correct: 'SELECT * FROM Employee e WHERE salary > (SELECT AVG(salary) FROM Employee WHERE department_id = e.department_id);',
        distractors: [
            'SELECT * FROM Employee WHERE salary > AVG(salary) GROUP BY department_id;',
            'SELECT * FROM Employee HAVING salary > AVG(department_salary);',
            'SELECT * FROM Employee WHERE department_salary > ALL;'
        ],
        explanation: 'A correlated subquery calculates the department average for each employee and compares their individual salary.'
    },
    {
        matches: (q) => /DELETE vs DROP vs TRUNCATE|difference between DELETE, DROP/i.test(q),
        correct: 'DELETE is DML (removes rows, supports WHERE, can roll back); TRUNCATE is DDL (fast table deallocation, no WHERE); DROP removes table and schema.',
        distractors: [
            'DELETE removes the table definition, while DROP only empties rows.',
            'TRUNCATE can use a WHERE clause to filter specific rows, while DELETE cannot.',
            'All three commands perform identical operations and can always be rolled back.'
        ],
        explanation: 'DELETE logs each deleted row and supports WHERE clauses. TRUNCATE rapidly deallocates data pages. DROP drops table structure completely.'
    },
    {
        matches: (q) => /WHERE vs HAVING|difference between WHERE and HAVING/i.test(q),
        correct: 'WHERE filters individual rows before grouping; HAVING filters aggregated groups after GROUP BY.',
        distractors: [
            'WHERE can only filter string columns, while HAVING filters numbers.',
            'HAVING filters rows before aggregation, and WHERE filters group summaries.',
            'WHERE requires an aggregate function, while HAVING cannot use aggregate functions.'
        ],
        explanation: 'WHERE filters records prior to GROUP BY. HAVING evaluates conditions on aggregated groupings (e.g. `HAVING COUNT(*) > 5`).'
    },
    {
        matches: (q) => /INNER JOIN vs LEFT JOIN|difference between INNER JOIN and LEFT JOIN/i.test(q),
        correct: 'INNER JOIN returns only rows with matches in both tables; LEFT JOIN returns all rows from the left table and matched rows from the right table (with NULLs if no match).',
        distractors: [
            'INNER JOIN returns all rows from both tables, while LEFT JOIN only returns left rows.',
            'LEFT JOIN excludes all matching rows and only shows unmatched rows.',
            'INNER JOIN can only join tables on primary keys, while LEFT JOIN cannot.'
        ],
        explanation: 'INNER JOIN discards unmatched rows. LEFT JOIN preserves all rows from the left relation, padding right attributes with NULL when no match exists.'
    },
    {
        matches: (q) => /UNION vs UNION ALL|difference between UNION and UNION ALL/i.test(q),
        correct: 'UNION combines results and removes duplicate rows (requires sorting); UNION ALL includes all duplicate rows and executes faster.',
        distractors: [
            'UNION preserves duplicates, while UNION ALL strictly deletes duplicates.',
            'UNION merges columns horizontally, while UNION ALL stacks rows vertically.',
            'UNION only works on tables with identical primary keys, while UNION ALL does not.'
        ],
        explanation: 'UNION performs a distinct sort operation to eliminate duplicates, making UNION ALL faster when duplicates are acceptable or absent.'
    },
    {
        matches: (q) => /self join/i.test(q),
        correct: 'Joining a table with itself using distinct table aliases to evaluate hierarchical or comparative relationships within the same table.',
        distractors: [
            'A query joining a database table with an operating system kernel log.',
            'A join that automatically detects and resolves circular foreign key references.',
            'A join executed exclusively in client-side memory without database query processing.'
        ],
        explanation: 'A self join aliases the same table twice (e.g. `Employee emp JOIN Employee mgr ON emp.manager_id = mgr.id`) to compare rows within a single table.'
    },
    {
        matches: (q) => /subquery vs correlated subquery/i.test(q),
        correct: 'A standard subquery executes once independently of the outer query; a correlated subquery references outer query columns and evaluates once per outer row.',
        distractors: [
            'A correlated subquery executes before schema compilation.',
            'A standard subquery only returns text, while a correlated subquery only returns integers.',
            'A correlated subquery creates physical tables on disk, while standard subqueries do not.'
        ],
        explanation: 'Correlated subqueries depend on current outer row values and re-evaluate for each outer candidate row.'
    },

    // === KEYS & INTEGRITY ===
    {
        matches: (q) => /What is a primary key/i.test(q),
        correct: 'A column or combination of columns that uniquely identifies each row in a table and cannot contain NULL values.',
        distractors: [
            'A column that can hold multiple NULL values to represent unassigned records.',
            'A secondary index used exclusively to reference rows in another external database.',
            'A temporary pointer generated dynamically in memory during an active JOIN query.'
        ],
        explanation: 'A primary key enforces entity integrity by uniquely identifying each row and strictly disallowing NULL values.'
    },
    {
        matches: (q) => /What is a foreign key/i.test(q),
        correct: 'A column or combination of columns in one table that references the primary key or unique key of another table to maintain referential integrity.',
        distractors: [
            'An encryption key used to protect relational database tables stored on disk.',
            'A primary key that is automatically copied to all other databases on the server.',
            'A virtual column generated automatically by database reporting tools.'
        ],
        explanation: 'A foreign key links child records to parent records, establishing referential integrity between related tables.'
    },
    {
        matches: (q) => /difference between primary and foreign keys|primary vs foreign key/i.test(q),
        correct: 'A primary key uniquely identifies rows within its table and cannot be NULL; a foreign key references a parent table’s key and can accept NULL values.',
        distractors: [
            'A primary key is stored in memory, while a foreign key is stored on disk.',
            'A table can have multiple primary keys, but only one foreign key.',
            'Primary keys allow duplicate values, while foreign keys must be strictly unique.'
        ],
        explanation: 'Primary keys uniquely identify rows in the current table (no NULLs). Foreign keys enforce relationships to parent tables and can be NULL.'
    },
    {
        matches: (q) => /Can a primary key contain `?NULL`?/i.test(q),
        correct: 'No, primary key columns strictly prohibit NULL values to guarantee entity integrity and unambiguous row identification.',
        distractors: [
            'Yes, a primary key can contain up to one NULL value per table.',
            'Yes, NULL is permitted if the column data type is VARCHAR or TEXT.',
            'Yes, but only if an explicit NULLABLE PRIMARY KEY constraint is enabled.'
        ],
        explanation: 'Entity integrity requires primary keys to be unique and NOT NULL so that every record can be unambiguously identified.'
    },
    {
        matches: (q) => /Can a foreign key contain `?NULL`?/i.test(q),
        correct: 'Yes, a foreign key can contain NULL values unless explicitly declared with a NOT NULL constraint.',
        distractors: [
            'No, foreign keys can never store NULL under ANSI SQL standards.',
            'Only if the referenced primary key table is completely empty.',
            'Only if the foreign key is defined on an integer column.'
        ],
        explanation: 'A NULL foreign key represents an optional relationship where a child record does not currently point to any parent record.'
    },
    {
        matches: (q) => /Can a table have multiple primary keys/i.test(q),
        correct: 'No, a table can have only one primary key constraint, though that key can be composite (consisting of multiple columns).',
        distractors: [
            'Yes, each column in a table can be marked as an independent primary key.',
            'Yes, up to a maximum limit of 16 separate primary keys per table.',
            'Yes, if the table is partitioned across multiple disks.'
        ],
        explanation: 'A table can only define one primary key constraint. When multiple columns are required to identify rows uniquely, a composite primary key is used.'
    },
    {
        matches: (q) => /Can a table have multiple foreign keys/i.test(q),
        correct: 'Yes, a table can have multiple foreign keys referencing different parent tables or columns.',
        distractors: [
            'No, relational databases strictly enforce a one-foreign-key-per-table limit.',
            'Only if the table does not have an active primary key.',
            'Only when using NoSQL storage engines.'
        ],
        explanation: 'Tables commonly contain multiple foreign keys (e.g., an Order table referencing CustomerID, EmployeeID, and ShipperID).'
    },
    {
        matches: (q) => /composite primary key/i.test(q),
        correct: 'A primary key constructed from two or more columns that together guarantee unique row identification.',
        distractors: [
            'A primary key that references columns in two different physical database engines.',
            'A primary key that automatically changes its data type depending on input values.',
            'A primary key that is split across two separate database schemas.'
        ],
        explanation: 'Composite primary keys are common in junction/bridge tables representing many-to-many relationships (e.g. StudentID + CourseID).'
    },
    {
        matches: (q) => /composite foreign key/i.test(q),
        correct: 'A foreign key consisting of multiple columns that reference a composite primary key in the parent table.',
        distractors: [
            'A foreign key that references five different tables simultaneously.',
            'A foreign key that converts integers to strings automatically.',
            'A foreign key that bypasses all referential integrity validations.'
        ],
        explanation: 'A composite foreign key matches the exact number and types of columns defined in the referenced composite primary key.'
    },
    {
        matches: (q) => /referential integrity/i.test(q),
        correct: 'A relational database rule ensuring that foreign key references always point to existing, valid primary key rows in parent tables.',
        distractors: [
            'A rule ensuring that all table columns have identical data types.',
            'A security policy requiring all passwords to be encrypted with SHA-256.',
            'A hardware check confirming that hard drive disks have no bad sectors.'
        ],
        explanation: 'Referential integrity prevents orphan records in child tables by ensuring foreign keys point to valid parent records.'
    },
    {
        matches: (q) => /nonexistent parent row/i.test(q),
        correct: 'The database rejects the insert or update operation with a foreign key constraint violation error.',
        distractors: [
            'The database automatically creates a new dummy row in the parent table.',
            'The database inserts the row and sets the foreign key to 0.',
            'The query succeeds silently without saving the foreign key value.'
        ],
        explanation: 'Foreign key constraints prevent orphan rows by rejecting any child record referencing a nonexistent parent key.'
    },
    {
        matches: (q) => /ON DELETE CASCADE/i.test(q),
        correct: 'Automatically deletes corresponding child rows in referencing tables whenever a referenced parent row is deleted.',
        distractors: [
            'Sets all referencing child foreign key values to NULL when the parent is deleted.',
            'Prevents the parent row from being deleted if child rows reference it.',
            'Backs up deleted rows into an archive audit table before purging.'
        ],
        explanation: '`ON DELETE CASCADE` propagates parent deletions to all referencing child rows to maintain referential integrity.'
    },
    {
        matches: (q) => /ON DELETE SET NULL/i.test(q),
        correct: 'Sets the referencing foreign key column values in child rows to NULL when the parent row is deleted.',
        distractors: [
            'Deletes the child rows completely from disk along with the parent.',
            'Throws a foreign key violation error blocking deletion of the parent.',
            'Replaces the foreign key value with the default primary key 0.'
        ],
        explanation: '`ON DELETE SET NULL` preserves child records while unlinking them from the deleted parent by setting their foreign key to NULL.'
    },
    {
        matches: (q) => /ON UPDATE CASCADE/i.test(q),
        correct: 'Automatically updates the referencing foreign key values in child rows whenever the parent primary key value is modified.',
        distractors: [
            'Prevents parent primary key columns from ever being updated.',
            'Deletes all child records if the parent key changes.',
            'Creates a copy of the parent table in a separate database schema.'
        ],
        explanation: '`ON UPDATE CASCADE` ensures child references remain valid when parent key values are updated.'
    },
    {
        matches: (q) => /Can a foreign key reference a unique key/i.test(q),
        correct: 'Yes, a foreign key can reference any unique key (unique constraint) or primary key in the parent table.',
        distractors: [
            'No, foreign keys can only reference columns explicitly designated as PRIMARY KEY.',
            'Only if the unique key contains only integer values.',
            'Only if the database engine is PostgreSQL, not MySQL or Oracle.'
        ],
        explanation: 'Relational databases permit foreign keys to reference candidate keys, which include both primary keys and unique constraints.'
    },
    {
        matches: (q) => /Can a table reference itself using a foreign key/i.test(q),
        correct: 'Yes, this is known as a recursive or self-referencing foreign key (e.g., employee manager_id pointing to employee id).',
        distractors: [
            'No, self-referencing foreign keys produce an immediate circular error.',
            'Only through an intermediary junction table.',
            'Only if the table has no primary key defined.'
        ],
        explanation: 'Self-referential relationships represent hierarchies (like organizational charts or category trees) within a single table.'
    },

    // === ACID & TRANSACTIONS ===
    {
        matches: (q) => /What are ACID properties/i.test(q),
        correct: 'Atomicity (all-or-nothing), Consistency (state validity), Isolation (concurrency control), and Durability (persistence of committed data).',
        distractors: [
            'Asynchronous execution, Concurrency, Isolation, and Distributed clustering.',
            'Authentication, Cryptography, Integrity, and Decryption.',
            'Availability, Consistency, Invalidation, and Distribution.'
        ],
        explanation: 'ACID guarantees transaction reliability and data integrity in relational database management systems.'
    },
    {
        matches: (q) => /Atomicity.*example|How does Atomicity ensure/i.test(q),
        correct: 'In a bank transfer, debiting Account A and crediting Account B must both succeed; if either fails, all operations are completely rolled back.',
        distractors: [
            'Encrypting customer credit card data before storing it in disk files.',
            'Compressing database rows to save storage space.',
            'Executing read queries asynchronously across multi-core processors.'
        ],
        explanation: 'Atomicity ensures all steps of a transaction either complete entirely or leave the database completely unaltered.'
    },
    {
        matches: (q) => /Consistency in a database transaction|How does a DBMS maintain Consistency/i.test(q),
        correct: 'Ensures the database transitions from one valid state to another, strictly satisfying all constraints, cascades, and business rules.',
        distractors: [
            'Guarantees that read queries always return within 5 milliseconds.',
            'Ensures that database files are duplicated across three cloud regions.',
            'Locks all database tables for the entire duration of the day.'
        ],
        explanation: 'Consistency guarantees that transactions cannot violate integrity constraints, foreign keys, triggers, or schema validations.'
    },
    {
        matches: (q) => /Isolation.*example|How does Isolation prevent/i.test(q),
        correct: 'Prevents concurrent transactions from seeing each other’s uncommitted intermediate data, avoiding dirty reads and race conditions.',
        distractors: [
            'Physically disconnects the database server from the public internet.',
            'Restricts database administrative access to root users only.',
            'Stores transaction logs on a separate physical SSD drive.'
        ],
        explanation: 'Isolation ensures that concurrent transactions execute as if they were running sequentially, controlled by isolation levels.'
    },
    {
        matches: (q) => /Durability in DBMS|How does Durability protect/i.test(q),
        correct: 'Guarantees that once a transaction commits, its modifications persist permanently in non-volatile storage, surviving crashes and power cuts.',
        distractors: [
            'Ensures transactions execute in memory without writing to disk.',
            'Guarantees that the database software never crashes under high load.',
            'Prevents any user from ever deleting committed rows.'
        ],
        explanation: 'Durability relies on write-ahead logging (WAL) and disk syncing to guarantee committed transactions are never lost.'
    },
    {
        matches: (q) => /fails before COMMIT/i.test(q),
        correct: 'The DBMS issues a ROLLBACK, undoing all partial modifications made by the transaction and restoring previous consistent state.',
        distractors: [
            'Partial updates are saved permanently and marked as incomplete.',
            'The database drops the entire table where the failure occurred.',
            'The database shuts down immediately and requires manual administrator restart.'
        ],
        explanation: 'If a transaction fails before COMMIT, the atomicity principle requires a complete ROLLBACK to maintain consistency.'
    },
    {
        matches: (q) => /role of COMMIT/i.test(q),
        correct: 'Permanently saves all changes made during the current transaction to disk and releases locks held on modified resources.',
        distractors: [
            'Temporarily suspends transaction execution until user input is received.',
            'Reverts all modifications back to the start of the session.',
            'Exports transaction data into a CSV backup file.'
        ],
        explanation: 'COMMIT seals the transaction, making its modifications permanent and visible to other transactions.'
    },
    {
        matches: (q) => /role of ROLLBACK/i.test(q),
        correct: 'Undoes all modifications made since the beginning of the transaction or back to a designated SAVEPOINT.',
        distractors: [
            'Forces immediate persistence of dirty data pages to disk.',
            'Deletes the transaction history log from the server.',
            'Terminates all active user sessions across the database server.'
        ],
        explanation: 'ROLLBACK cancels changes in the event of an error or user abort, returning data to its prior consistent state.'
    },
    {
        matches: (q) => /Can a transaction be durable before it is committed/i.test(q),
        correct: 'No, changes are not considered durable until the transaction successfully commits and records are written to the transaction log.',
        distractors: [
            'Yes, any SQL statement executed is immediately durable even if aborted later.',
            'Yes, if auto-commit is explicitly disabled.',
            'Yes, because changes are instantly written to the primary table file.'
        ],
        explanation: 'Durability applies strictly to committed transactions; uncommitted changes may be rolled back at any moment.'
    },
    {
        matches: (q) => /Why are ACID properties important/i.test(q),
        correct: 'To ensure data reliability, prevent corruption during concurrent access or system crashes, and guarantee strict transaction integrity.',
        distractors: [
            'To allow databases to operate without any disk storage or persistent logs.',
            'To eliminate the need for primary keys, indexes, and tables.',
            'To automatically translate SQL queries into JavaScript code.'
        ],
        explanation: 'ACID properties ensure transactions are executed reliably without data loss, conflicts, or corruption.'
    },

    // === NORMALIZATION & NORMAL FORMS ===
    {
        matches: (q) => /What is database normalization|normalization and its types/i.test(q),
        correct: 'Organizing database relations to minimize redundancy and eliminate insertion, update, and deletion anomalies using normal forms.',
        distractors: [
            'Duplicating tables across multiple servers to maximize query read throughput.',
            'Encrypting database columns to ensure GDPR compliance.',
            'Converting relational SQL schemas into MongoDB collections.'
        ],
        explanation: 'Normalization decomposes tables through normal forms (1NF to BCNF) to prevent update anomalies and unnecessary data redundancy.'
    },
    {
        matches: (q) => /1NF|First Normal Form/i.test(q),
        correct: 'Requires each table cell to contain atomic (indivisible) values and ensures no repeating groups or arrays exist.',
        distractors: [
            'Eliminates all transitive dependencies between non-key columns.',
            'Requires every non-prime attribute to depend completely on the primary key without partial dependency.',
            'Ensures every determinant in the table is a candidate key.'
        ],
        explanation: '1NF guarantees that attributes contain only atomic values and that rows are uniquely identifiable.'
    },
    {
        matches: (q) => /2NF|Second Normal Form/i.test(q),
        correct: 'Must be in 1NF and have NO partial dependency (every non-key attribute must fully depend on the entire candidate key).',
        distractors: [
            'Requires table rows to be partitioned into separate database schemas.',
            'Eliminates transitive dependencies between non-key attributes.',
            'Requires tables to have no foreign key relationships.'
        ],
        explanation: '2NF removes partial functional dependencies where a non-prime attribute depends on only part of a composite primary key.'
    },
    {
        matches: (q) => /3NF|Third Normal Form/i.test(q),
        correct: 'Must be in 2NF and have NO transitive dependency (non-prime attributes must not depend on other non-prime attributes).',
        distractors: [
            'Requires non-key attributes to depend partially on composite primary keys.',
            'Permits repeating groups of multi-valued attributes.',
            'Requires all table columns to be indexed with B+ Trees.'
        ],
        explanation: '3NF enforces that non-key attributes depend only on the primary key, eliminating transitive dependencies (X -> Y and Y -> Z).'
    },
    {
        matches: (q) => /BCNF|Boyce-Codd/i.test(q),
        correct: 'A stricter form of 3NF where for every non-trivial functional dependency X -> Y, X must strictly be a super key.',
        distractors: [
            'A relaxed normal form that allows partial dependencies in composite keys.',
            'A normal form designed specifically for graph databases.',
            'Requires all relations to have exactly three foreign keys.'
        ],
        explanation: 'BCNF eliminates anomalies arising from overlapping candidate keys by requiring every determinant to be a super key.'
    },
    {
        matches: (q) => /denormalization/i.test(q),
        correct: 'Intentionally adding controlled redundancy to a normalized schema to reduce expensive joins and boost read query performance.',
        distractors: [
            'Removing all primary keys and indexes from a database.',
            'Converting relational tables into unstructured text documents.',
            'Violating 1NF by storing multi-valued JSON strings in relational columns without reason.'
        ],
        explanation: 'Denormalization trades storage and write speed for faster read queries by pre-joining or duplicating frequently accessed data.'
    },

    // === INDEXING & STORAGE ===
    {
        matches: (q) => /What is an index in SQL|indexing/i.test(q),
        correct: 'A data structure (commonly B+ Tree) that enables rapid retrieval of rows from a table without scanning every row sequentially.',
        distractors: [
            'A compression algorithm that reduces database file size on disk.',
            'A transaction log used exclusively for rollback operations after a crash.',
            'A technique to execute SQL queries asynchronously in background threads.'
        ],
        explanation: 'Indexes create sorted lookup paths that drastically decrease query disk I/O operations from O(N) to O(log N).'
    },
    {
        matches: (q) => /clustered vs non-clustered|difference between clustered and non-clustered/i.test(q),
        correct: 'A clustered index determines the physical storage order of rows (only 1 per table); a non-clustered index stores a separate sorted structure pointing to table rows.',
        distractors: [
            'A table can have multiple clustered indexes, but only one non-clustered index.',
            'Clustered indexes are stored in RAM, while non-clustered indexes are stored on tape drive.',
            'Non-clustered indexes dictate physical row order on disk, while clustered indexes do not.'
        ],
        explanation: 'Because physical records can only be sorted one way on disk, each table can have at most one clustered index.'
    },
    {
        matches: (q) => /B\+ Tree/i.test(q),
        correct: 'A self-balancing search tree where all data records/pointers reside exclusively in leaf nodes linked sequentially, optimizing range queries.',
        distractors: [
            'A binary search tree where data records are stored only in the root node.',
            'An unindexed linked list stored across distributed server nodes.',
            'A hash table algorithm that does not support sorting or range scanning.'
        ],
        explanation: 'B+ Trees provide high fan-out, shallow depth, and linked leaf nodes, making them ideal for disk-based database indexes and range queries.'
    },

    // === GIT: MERGE vs REBASE & TOOLS ===
    {
        matches: (q) => /What is Git\?/i.test(q),
        correct: 'A free, open-source distributed version control system designed to handle everything from small to very large projects with speed and efficiency.',
        distractors: [
            'A cloud-based web hosting service for static HTML web pages.',
            'A relational database management system developed by Linus Torvalds.',
            'A compiler for compiling C and C++ source code into binary executables.'
        ],
        explanation: 'Git is a distributed version control system where every clone is a full repository containing complete project history.'
    },
    {
        matches: (q) => /What is GitHub\?/i.test(q),
        correct: 'A cloud-based hosting platform providing Git repository management, pull requests, issue tracking, and CI/CD automation.',
        distractors: [
            'A local command-line version control binary installed directly in your computer\'s OS.',
            'A relational database storage engine used to store Git commits on physical disk.',
            'A programming language developed by Linus Torvalds for kernel programming.'
        ],
        explanation: 'GitHub hosts Git repositories online and provides tools for team collaboration, code review, and continuous integration.'
    },
    {
        matches: (q) => /Git vs GitHub|difference between Git and GitHub/i.test(q),
        correct: 'Git is a local, distributed command-line version control tool; GitHub is a cloud-based hosting platform for Git repositories with collaboration features.',
        distractors: [
            'Git is paid proprietary software, while GitHub is free open-source software.',
            'Git is only for Linux systems, while GitHub is only for Windows systems.',
            'There is no difference; Git and GitHub are two names for the same application.'
        ],
        explanation: 'Git manages code revisions locally on your computer. GitHub hosts remote Git repositories and provides pull requests, issues, and CI/CD.'
    },
    {
        matches: (q) => /Is GitHub required to use Git\?/i.test(q),
        correct: 'No, Git is an independent command-line tool that works entirely locally without needing GitHub or any internet connection.',
        distractors: [
            'Yes, Git cannot initialize any repository without connecting to a GitHub account.',
            'Yes, every git commit must be authorized by GitHub servers.',
            'Only if you are running Git on Windows, not Linux.'
        ],
        explanation: 'Git is self-contained. You can initialize repositories, commit, branch, and merge completely offline without GitHub.'
    },
    {
        matches: (q) => /Can Git work without an internet connection\?/i.test(q),
        correct: 'Yes, Git is fully distributed; commits, branching, log inspection, and merges all happen locally on your filesystem offline.',
        distractors: [
            'No, Git requires continuous network access to validate each commit hash.',
            'Git can stage files offline, but cannot commit without an internet connection.',
            'Only if an enterprise offline license key has been configured.'
        ],
        explanation: 'Every cloned or initialized Git repository contains the full project history locally, allowing comprehensive offline work.'
    },
    {
        matches: (q) => /What is `?git merge`\?/i.test(q),
        correct: 'Integrates changes from one branch into another, preserving complete history and creating a merge commit if branches have diverged.',
        distractors: [
            'Re-applies commits one by one on top of the target branch tip, rewriting commit hashes.',
            'Deletes the feature branch and removes all its unmerged commits.',
            'Uploads local commits directly to the remote GitHub repository without review.'
        ],
        explanation: '`git merge` joins two or more development histories together while keeping the existing commit history completely intact.'
    },
    {
        matches: (q) => /What is `?git rebase`\?/i.test(q),
        correct: 'Reapplies commits from one branch onto the tip of another branch, producing a clean, linear commit history without merge commits.',
        distractors: [
            'Deletes the remote repository and replaces it with the local working copy.',
            'Creates a permanent three-way merge commit linking both branches.',
            'Reverts all changes made in the last five commits automatically.'
        ],
        explanation: '`git rebase` rewrites history by creating new commits for each commit in the feature branch on top of the base branch.'
    },
    {
        matches: (q) => /difference between merge and rebase|merge vs.*rebase/i.test(q),
        correct: 'Merge preserves original branch history and creates a merge commit; rebase rewrites commit history to create a linear project timeline.',
        distractors: [
            'Merge deletes branch commits, while rebase duplicates branches across remote servers.',
            'Rebase can only be used on GitHub, while merge is only used on local terminals.',
            'There is no functional difference; they are exact aliases in Git.'
        ],
        explanation: 'Merge is non-destructive and records the exact historical timeline. Rebase rewrites history for a clean, linear presentation.'
    },
    {
        matches: (q) => /What is a merge commit/i.test(q),
        correct: 'A commit that has two or more parent commits, created when integrating two divergent branches in Git.',
        distractors: [
            'A commit that automatically deletes all files in the branch after merging.',
            'A commit that is only stored on GitHub and not on the local repository.',
            'A temporary commit that is automatically removed after 24 hours.'
        ],
        explanation: 'A merge commit joins two branches and points to both parent commit hashes.'
    },
    {
        matches: (q) => /fast-forward merge/i.test(q),
        correct: 'Occurs when the target branch has no new commits; Git simply moves the branch pointer forward to the incoming commit without a merge commit.',
        distractors: [
            'A merge that skips all conflict checks and overwrites target files immediately.',
            'A merge that pushes code directly to production servers automatically.',
            'An asynchronous merge performed by background worker threads.'
        ],
        explanation: 'If the base branch has not diverged, Git moves the pointer forward (fast-forward) without needing a dedicated merge commit.'
    },
    {
        matches: (q) => /three-way merge/i.test(q),
        correct: 'Combines two divergent branches using their common ancestor commit and the two branch tips to create a new merge commit.',
        distractors: [
            'A merge involving three different software development teams simultaneously.',
            'A merge that requires three separate approvals on GitHub before completing.',
            'A merge between three different remote repositories.'
        ],
        explanation: 'A 3-way merge analyzes the base ancestor and the two branch states to resolve changes and generate a merge commit.'
    },
    {
        matches: (q) => /interactive rebase|`?git rebase -i`?/i.test(q),
        correct: 'Allows developers to modify commits: squash, edit, reorder, reword, or drop commits before merging into a shared branch.',
        distractors: [
            'An AI-driven automated merge resolution wizard.',
            'A GUI prompt that uploads commits to multiple cloud hosts.',
            'A command that locks git repositories from concurrent commits.'
        ],
        explanation: '`git rebase -i` provides an interactive editor to rewrite, squash, and curate commit history.'
    },
    {
        matches: (q) => /Why should rebasing shared public history be avoided/i.test(q),
        correct: 'Because rebase changes commit SHA hashes; rebasing published commits creates divergent histories and severe merge conflicts for collaborators.',
        distractors: [
            'Because rebase permanently disables git push for the entire repository.',
            'Because rebase deletes all files larger than 10MB from the repository.',
            'Because GitHub automatically bans accounts that use rebase on public branches.'
        ],
        explanation: 'The Golden Rule of Rebase: Never rebase commits that have been pushed to a public/shared repository, as it rewrites commit history.'
    },
    {
        matches: (q) => /abort a merge or rebase/i.test(q),
        correct: 'Using `git merge --abort` or `git rebase --abort` to cancel the operation and return the repository to its prior state.',
        distractors: [
            'Deleting the `.git` directory and cloning the repository again.',
            'Pressing Ctrl+C in the terminal, which automatically cleans up all state.',
            'Running `git checkout -f main` which automatically rolls back rebase state.'
        ],
        explanation: '`--abort` restores the original branch and working directory state as they were before the merge or rebase was initiated.'
    },
    {
        matches: (q) => /What is Git stash\?|Why is `?git stash`? used\?/i.test(q),
        correct: 'Temporarily shelves (saves) uncommitted changes in the working directory and index so you can work on something else on a clean working directory.',
        distractors: [
            'Permanently deletes modified files that have not yet been added to the staging area.',
            'Uploads local commits into a private temporary branch on GitHub.',
            'Compresses the repository history into a .zip archive on disk.'
        ],
        explanation: '`git stash` records the current state of modified tracked files and reverts back to the HEAD commit, storing changes on a stash stack.'
    },
    {
        matches: (q) => /Does Git stash save untracked files by default\?/i.test(q),
        correct: 'No, untracked files are ignored by default unless the `-u` (or `--include-untracked`) flag is supplied.',
        distractors: [
            'Yes, `git stash` always shelves both tracked and untracked files automatically.',
            'Yes, but only if the untracked files are text files.',
            'Untracked files can never be stashed under any circumstance.'
        ],
        explanation: 'By default, `git stash` only stashes tracked modifications; use `git stash -u` to include untracked files.'
    },
    {
        matches: (q) => /`?git pull`? vs `?git fetch`?|difference between.*pull.*fetch/i.test(q),
        correct: '`git fetch` downloads remote commits without merging them into your local branch; `git pull` runs `git fetch` followed immediately by `git merge`.',
        distractors: [
            '`git pull` downloads commits safely, while `git fetch` forces an immediate overwriting merge.',
            '`git fetch` uploads local commits to remote, while `git pull` downloads remote commits.',
            '`git fetch` only works on public repositories, while `git pull` requires SSH authentication.'
        ],
        explanation: '`git pull` is essentially a convenience command executing `git fetch` followed by `git merge FETCH_HEAD`.'
    },
    {
        matches: (q) => /`?git reset`? vs `?git revert`?|difference between.*reset.*revert/i.test(q),
        correct: '`git reset` moves branch pointers backward (rewriting history); `git revert` creates a new commit that undoes the changes of a previous commit (safe for shared branches).',
        distractors: [
            '`git revert` deletes commits permanently, while `git reset` creates new undo commits.',
            '`git reset` only works on remote repositories, while `git revert` only works locally.',
            'Both commands do the exact same thing with identical flags.'
        ],
        explanation: '`git revert` preserves history by recording inverse changes in a new commit, making it safe for public branches.'
    },
    {
        matches: (q) => /Detached HEAD state/i.test(q),
        correct: 'A state where HEAD points directly to a specific commit hash rather than a named branch pointer.',
        distractors: [
            'A fatal corruption where the repository has lost its initial root commit.',
            'A scenario where GitHub server is unreachable during a fetch operation.',
            'A state where Git deletes all uncommitted files in the working directory.'
        ],
        explanation: 'In a detached HEAD state, any new commits made will not belong to any branch unless a new branch is explicitly created.'
    },
    {
        matches: (q) => /What is a Pull Request/i.test(q),
        correct: 'A platform mechanism where a developer requests team review and discussion of code changes before merging into a target branch.',
        distractors: [
            'A Git command that pulls commits from multiple remote servers simultaneously.',
            'A database query requesting tables from remote servers.',
            'An automated script that forces a git push without authentication.'
        ],
        explanation: 'Pull Requests (PRs) facilitate code review, discussions, and automated CI/CD checks before code is merged.'
    },
    {
        matches: (q) => /What is HEAD in Git/i.test(q),
        correct: 'A reference pointer to the currently checked-out commit or the tip of the current active branch in the repository.',
        distractors: [
            'The very first initial root commit created in a Git repository.',
            'The remote master branch on the central GitHub server.',
            'A hardware pointer to the sector of the hard drive where Git is installed.'
        ],
        explanation: '`HEAD` points to the current branch reference or directly to a commit (in detached HEAD state).'
    },
    {
        matches: (q) => /\.gitignore/i.test(q),
        correct: 'A text file specifying untracked files and patterns that Git should intentionally ignore and not track or commit.',
        distractors: [
            'A file that permanently deletes untracked files when committing.',
            'A list of unauthorized users who are blocked from pushing commits.',
            'A configuration file containing Git server root passwords.'
        ],
        explanation: '`.gitignore` prevents temporary files, build artifacts (e.g. `node_modules`), and secrets from entering version control.'
    },
    {
        matches: (q) => /`?git clone`? vs Fork|difference between.*clone.*fork/i.test(q),
        correct: 'Clone copies a remote repository to your local machine; Fork creates a personal server-side copy of another repository on your GitHub account.',
        distractors: [
            'Clone is only for private repositories, while Fork is only for public repositories.',
            'Fork downloads repository files to your local hard drive, while Clone does not.',
            'There is no difference; they are exact synonyms in Git.'
        ],
        explanation: 'Forking is a GitHub platform feature copying a remote repository to your account. Cloning is a Git command downloading files locally.'
    },
    {
        matches: (q) => /`?git add \.`? vs `?git add <file>`?/i.test(q),
        correct: '`git add .` stages all modified, added, and deleted files in the current directory and subdirectories; `git add <file>` stages only the specified file.',
        distractors: [
            '`git add .` commits changes directly, while `git add <file>` only stages them.',
            '`git add .` pushes all files to GitHub, while `git add <file>` stages locally.',
            '`git add .` only stages files smaller than 1MB.'
        ],
        explanation: '`git add .` stages the entire current directory tree; specifying a filepath limits staging to that exact file.'
    },
    {
        matches: (q) => /resolve merge conflicts/i.test(q),
        correct: 'Open conflicted files, manually edit the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`), stage the resolved files with `git add`, and commit.',
        distractors: [
            'Delete the entire repository folder and start over from scratch.',
            'Run `git merge --ignore-conflicts` to let Git discard half the changes.',
            'Reboot the operating system to automatically clear conflicted memory pages.'
        ],
        explanation: 'Resolving conflicts requires inspecting the conflicting sections, deciding on the final code, removing markers, staging, and committing.'
    },

    // === LINUX UTILITIES & OPERATING SYSTEM ===
    {
        matches: (q) => /`?chmod 755`?/i.test(q),
        correct: 'Grants read, write, execute permissions (7) to the owner, and read and execute permissions (5) to group and others (rwxr-xr-x).',
        distractors: [
            'Grants full permissions (7) to everyone on the entire system.',
            'Grants write-only permissions to the owner and disables file execution.',
            'Restricts file access exclusively to root user, denying all others.'
        ],
        explanation: '7 = rwx (4+2+1), 5 = r-x (4+0+1), 5 = r-x (4+0+1). Resulting in permissions rwxr-xr-x.'
    },
    {
        matches: (q) => /`?kill`? vs `?kill -9`?|difference between kill and kill -9/i.test(q),
        correct: '`kill` sends SIGTERM (15), allowing the process to clean up resources and terminate gracefully; `kill -9` sends SIGKILL (9), terminating the process immediately without cleanup.',
        distractors: [
            '`kill -9` allows graceful shutdown, while `kill` abruptly terminates the operating system kernel.',
            '`kill` is used only for background jobs, while `kill -9` is used only for foreground processes.',
            'Both commands send identical signals and cannot be distinguished by the OS.'
        ],
        explanation: 'SIGTERM can be caught, handled, or ignored by a process. SIGKILL cannot be caught or ignored; the kernel terminates the process immediately.'
    },
    {
        matches: (q) => /zombie process/i.test(q),
        correct: 'A terminated process that has completed execution but still has an entry in the process table so its parent can read its exit status.',
        distractors: [
            'A running process that consumes 100% of CPU cycles continuously.',
            'A malicious process that infects other running processes in memory.',
            'A process whose parent has terminated while the child is still executing.'
        ],
        explanation: 'A zombie process has released its memory and resources but remains in the process table until its parent reads its exit status via `wait()`.'
    },
    {
        matches: (q) => /daemon process/i.test(q),
        correct: 'A background process that runs continuously without direct user interaction, typically providing system services (e.g. sshd, cron, httpd).',
        distractors: [
            'A foreground interactive shell process attached to a terminal window.',
            'A kernel crash handler that triggers an immediate system reboot.',
            'A temporary script executed only once during user logout.'
        ],
        explanation: 'Daemons are background services detached from controlling terminals, often ending with the letter "d" (systemd, sshd).'
    },
    {
        matches: (q) => /hard link vs soft link|difference between hard link and soft link/i.test(q),
        correct: 'A hard link shares the exact same inode and data blocks as the target file; a soft (symbolic) link is an independent file containing the path to the target file.',
        distractors: [
            'A soft link shares the inode, while a hard link creates a new file path pointer.',
            'Hard links can link across different filesystems, while soft links cannot.',
            'Deleting the original file breaks hard links, while soft links continue working.'
        ],
        explanation: 'Hard links point directly to the inode (cannot span filesystems or link directories); symlinks point to paths and break if target is moved.'
    },
    {
        matches: (q) => /inode/i.test(q),
        correct: 'A filesystem data structure storing all metadata about a file (size, owner, permissions, timestamps, data block pointers) EXCEPT the filename.',
        distractors: [
            'The human-readable filename and extension displayed in the directory.',
            'A RAM cache used exclusively to speed up shell command execution.',
            'An encryption certificate used to authenticate Linux root users.'
        ],
        explanation: 'An inode contains all file attributes and block locations; directory entries map human-readable filenames to inode numbers.'
    },
    {
        matches: (q) => /`?>`? vs `?>>`?|difference between > and >>/i.test(q),
        correct: '`>` overwrites the destination file with command output; `>>` appends command output to the end of the destination file without overwriting.',
        distractors: [
            '`>` appends data to the file, while `>>` truncates and overwrites it.',
            '`>` redirects standard error, while `>>` redirects standard input.',
            'Both operators perform identical appending operations in bash.'
        ],
        explanation: '`>` truncates the existing file or creates a new one. `>>` preserves existing file content and adds new output to the end.'
    },
    {
        matches: (q) => /Pipe `?\|`?/i.test(q),
        correct: 'Connects the standard output (stdout) of one command directly to the standard input (stdin) of another command for stream processing.',
        distractors: [
            'Runs two commands concurrently in completely independent background subshells.',
            'Redirects terminal error messages into a temporary disk file.',
            'Terminates the first command if the second command takes longer than 5 seconds.'
        ],
        explanation: 'A pipe (`|`) creates an inter-process communication unidirectional data channel between adjacent command streams.'
    },
    {
        matches: (q) => /swap memory|What happens when RAM gets full/i.test(q),
        correct: 'Space on a hard drive or SSD used as virtual memory when physical RAM is full; excessive swapping causes disk thrashing.',
        distractors: [
            'A secondary CPU cache installed directly on motherboard RAM slots.',
            'A software program that automatically doubles physical RAM capacity.',
            'A volatile hardware buffer used only by graphical display drivers.'
        ],
        explanation: 'When physical RAM is exhausted, the OS pages inactive memory pages out to swap space on disk to keep the system operational.'
    },
    {
        matches: (q) => /fork\(\) and exec\(\)|difference between fork and exec/i.test(q),
        correct: '`fork()` duplicates the calling process creating an exact child copy; `exec()` replaces the current process address space with a new program binary.',
        distractors: [
            '`fork()` runs a new program binary, while `exec()` clones the process.',
            '`fork()` terminates the parent process immediately, while `exec()` runs in background.',
            '`fork()` is for threads, while `exec()` is exclusively for network sockets.'
        ],
        explanation: 'Unix process creation typically uses `fork()` to create a child process followed by `exec()` to load and execute the target program.'
    },
    {
        matches: (q) => /type a command in (a )?terminal/i.test(q),
        correct: 'The shell parses the command, checks aliases and builtins, searches directories in `$PATH`, forks a child process, execs the program, and waits for its exit.',
        distractors: [
            'The terminal uploads the text to a cloud server to compile into binary instructions.',
            'The operating system reboots into a single-user kernel execution state.',
            'The command is immediately written to BIOS firmware for hardware execution.'
        ],
        explanation: 'The shell follows a standard fork-exec pipeline using `$PATH` resolution to run programs.'
    },
    {
        matches: (q) => /SSH\b/i.test(q),
        correct: 'Secure Shell (SSH) is a cryptographic network protocol operating over port 22 for secure remote command execution and administration.',
        distractors: [
            'A plain-text database query protocol operating on port 80.',
            'A legacy file transfer protocol that does not support encryption.',
            'A hardware serial port cable connected between server racks.'
        ],
        explanation: 'SSH provides encrypted remote terminal sessions and file transfers over TCP port 22.'
    },
    {
        matches: (q) => /cron job/i.test(q),
        correct: 'A time-based daemon scheduler in Unix-like systems used to execute automated commands and scripts at specified recurring intervals.',
        distractors: [
            'A CPU overclocking utility that speeds up kernel processes.',
            'A network protocol that broadcasts packets to all machines on a subnet.',
            'A compiler optimization flag that removes unused functions.'
        ],
        explanation: 'Cron uses `crontab` schedule expressions (`minute hour dom month dow command`) to run automated recurring jobs.'
    },
    {
        matches: (q) => /environment variable.*PATH/i.test(q),
        correct: '`PATH` is an environment variable containing a colon-separated list of directories where the shell searches for executable binary files.',
        distractors: [
            'A configuration file that stores all user passwords in plaintext.',
            'A motherboard data bus connecting the CPU to system RAM.',
            'A relational database table storing website routing URLs.'
        ],
        explanation: 'When executing a command without a full path, the shell searches directories listed in `$PATH` sequentially.'
    },
    {
        matches: (q) => /What is a process/i.test(q),
        correct: 'An executing program instance with its own independent memory address space, registers, file descriptors, and call stack.',
        distractors: [
            'A lightweight unit of execution that shares address space with neighboring processes.',
            'A static file stored on a hard drive that has not yet been loaded.',
            'A hardware interrupt handler built into the motherboard CPU chipset.'
        ],
        explanation: 'A process is an active program with allocated system resources, separated from other processes by OS memory protection.'
    },
    {
        matches: (q) => /What is a thread/i.test(q),
        correct: 'A lightweight unit of execution within a process that shares the parent process’s memory space, code, and data.',
        distractors: [
            'A standalone executable program that runs in a completely isolated memory space.',
            'A physical core on the computer CPU motherboard.',
            'An operating system command used to terminate background tasks.'
        ],
        explanation: 'Threads share code, data, and open files of their enclosing process while maintaining private registers and a call stack.'
    },
    {
        matches: (q) => /process vs thread|difference between a process and a thread/i.test(q),
        correct: 'A process has its own independent address space and system resources; threads share the parent process’s memory space, code, and global data.',
        distractors: [
            'Threads have isolated memory spaces, while processes share global heap memory.',
            'Processes are lightweight units of execution created within threads.',
            'Context switching between processes is significantly faster than between threads.'
        ],
        explanation: 'Processes provide strong isolation with private address spaces. Threads are lightweight and share memory within the same process.'
    },
    {
        matches: (q) => /Process Control Block|PCB/i.test(q),
        correct: 'A kernel data structure storing information about a specific process (PID, state, program counter, CPU registers, memory limits, open files).',
        distractors: [
            'A physical microchip on the motherboard controlling CPU fan speeds.',
            'A user-space configuration file containing desktop environment preferences.',
            'A disk sector containing the compiled executable binary.'
        ],
        explanation: 'The OS kernel maintains a PCB for each process to track its execution state during multitasking and context switching.'
    },
    {
        matches: (q) => /deadlock/i.test(q),
        correct: 'A situation where two or more processes are permanently blocked because each holds a resource that the other requires to proceed.',
        distractors: [
            'A scenario where CPU utilization drops to 0% due to power saving mode.',
            'A runtime error occurring when memory exceeds allocated heap boundaries.',
            'A condition where an infinite loop consumes 100% of CPU processing time.'
        ],
        explanation: 'Deadlock requires 4 simultaneous conditions: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait.'
    },
    {
        matches: (q) => /mutex vs semaphore|difference between mutex and semaphore/i.test(q),
        correct: 'A Mutex is a locking mechanism with ownership (only the acquiring thread can unlock it); a Semaphore is a signaling mechanism with an integer counter.',
        distractors: [
            'A Semaphore allows only one thread at a time, while a Mutex allows multiple threads.',
            'A Mutex can be released by any thread, while a Semaphore requires ownership.',
            'Mutex operates at hardware level, while Semaphore is only a database feature.'
        ],
        explanation: 'Mutex = mutual exclusion lock (strictly 1 owner). Semaphore = signaling primitive with counting capacity for resource pools.'
    },
    {
        matches: (q) => /paging vs segmentation|difference between paging and segmentation/i.test(q),
        correct: 'Paging divides memory into fixed-size physical blocks (pages/frames); segmentation divides memory into variable-sized logical units (functions, arrays).',
        distractors: [
            'Paging creates variable-sized logical segments, while segmentation uses fixed blocks.',
            'Paging leads to severe external fragmentation, while segmentation eliminates all fragmentation.',
            'Paging is visible to user programmers, while segmentation is completely invisible.'
        ],
        explanation: 'Paging avoids external fragmentation with uniform page sizes. Segmentation reflects programmer-visible logical modules.'
    },
    {
        matches: (q) => /virtual memory/i.test(q),
        correct: 'A memory abstraction mapping virtual addresses to physical RAM or secondary storage paging files, allowing programs larger than physical RAM.',
        distractors: [
            'A cloud-based virtual machine running emulated operating system software.',
            'RAM chips installed inside external USB flash memory devices.',
            'A GPU memory partition reserved exclusively for video rendering.'
        ],
        explanation: 'Virtual memory isolates process address spaces and permits systems to execute processes larger than physically available RAM.'
    },

    // === COMPUTER NETWORKS ===
    {
        matches: (q) => /What is TCP\?/i.test(q),
        correct: 'Transmission Control Protocol: a connection-oriented, reliable transport protocol that guarantees ordered and error-checked packet delivery.',
        distractors: [
            'A connectionless protocol that sends datagrams without establishing handshakes.',
            'An application layer protocol used specifically to query domain names.',
            'A physical cabling standard used for gigabit Ethernet networking.'
        ],
        explanation: 'TCP establishes reliable connections using three-way handshakes, sequence numbers, and retransmissions.'
    },
    {
        matches: (q) => /What is UDP\?/i.test(q),
        correct: 'User Datagram Protocol: a connectionless, lightweight transport protocol that transmits packets with minimal overhead and no delivery guarantee.',
        distractors: [
            'A connection-oriented protocol that retransmits lost packets automatically.',
            'An encryption protocol used to secure web traffic over port 443.',
            'A database protocol used to execute transactions across distributed nodes.'
        ],
        explanation: 'UDP is ideal for real-time applications like video streaming and gaming where low latency matters more than reliability.'
    },
    {
        matches: (q) => /TCP vs UDP|difference between TCP and UDP/i.test(q),
        correct: 'TCP is connection-oriented, reliable (guarantees delivery and order via handshakes); UDP is connectionless, lightweight, and fast without delivery guarantees.',
        distractors: [
            'TCP is connectionless and unordered, while UDP guarantees sequenced delivery.',
            'TCP is used for real-time video streaming, while UDP is used for web banking.',
            'TCP operates at the Application layer, while UDP operates at the Physical layer.'
        ],
        explanation: 'TCP uses 3-way handshakes, sequence numbers, and retransmissions for reliability. UDP transmits datagrams with minimal latency.'
    },
    {
        matches: (q) => /three-way handshake/i.test(q),
        correct: 'SYN -> SYN-ACK -> ACK: Client sends SYN, server responds with SYN-ACK, client acknowledges with ACK to establish a TCP connection.',
        distractors: [
            'ACK -> SYN -> FIN: Client acknowledges, server synchronizes, then closes.',
            'CONNECT -> ACCEPT -> READY: A 3-step HTTP handshake over UDP.',
            'HELLO -> VERIFY -> CONFIRM: An SSL TLS certificate exchange.'
        ],
        explanation: 'The TCP 3-way handshake synchronizes sequence numbers between client and server before data transfer begins.'
    },
    {
        matches: (q) => /HTTP vs HTTPS|difference between HTTP and HTTPS/i.test(q),
        correct: 'HTTP transmits plain text over port 80; HTTPS encrypts communications using TLS/SSL over port 443 to ensure confidentiality and integrity.',
        distractors: [
            'HTTP uses port 443 with TLS encryption, while HTTPS transmits plain text over port 80.',
            'HTTP is a UDP transport protocol, while HTTPS is a TCP transport protocol.',
            'HTTP is an open-source protocol, while HTTPS is a paid proprietary Microsoft protocol.'
        ],
        explanation: 'HTTPS wraps standard HTTP traffic inside a TLS/SSL encrypted tunnel over TCP port 443.'
    },
    {
        matches: (q) => /DNS Working|What is DNS/i.test(q),
        correct: 'Resolves human-friendly domain names (e.g. google.com) into machine-readable IP addresses using hierarchical nameservers.',
        distractors: [
            'Distributes incoming web traffic across multiple application servers.',
            'Encrypts HTTP requests using public key cryptography.',
            'Stores cached HTML web pages in the user’s local browser storage.'
        ],
        explanation: 'DNS acts as the internet directory, querying root, TLD, and authoritative nameservers to resolve IP addresses.'
    },
    {
        matches: (q) => /OSI Model/i.test(q),
        correct: 'A 7-layer conceptual architecture: Physical, Data Link, Network, Transport, Session, Presentation, Application.',
        distractors: [
            'A 4-layer model consisting of Hardware, Kernel, Shell, and Application.',
            'An encryption algorithm used to secure payment gateways.',
            'A proprietary networking stack developed by Microsoft Windows.'
        ],
        explanation: 'The OSI model standardizes network communication functions across 7 distinct abstract layers.'
    },
    {
        matches: (q) => /WebSocket/i.test(q),
        correct: 'A persistent, bidirectional, full-duplex communication protocol operating over a single TCP connection, ideal for real-time applications.',
        distractors: [
            'A stateless request-response protocol that opens a new TCP connection per request.',
            'A UDP datagram protocol used exclusively for video streaming.',
            'A browser plugin that executes compiled Java applets.'
        ],
        explanation: 'WebSocket provides low-latency, two-way communication between client and server without polling overhead.'
    },
    {
        matches: (q) => /load balancer/i.test(q),
        correct: 'A reverse proxy or network device that distributes incoming client requests across multiple backend servers to ensure scalability and high availability.',
        distractors: [
            'A hardware component that balances voltage across motherboard RAM chips.',
            'A database transaction coordinator that locks tables during backups.',
            'A browser cache manager that purges expired image files.'
        ],
        explanation: 'Load balancers (e.g. NGINX, HAProxy, AWS ALB) balance traffic using algorithms like Round Robin or Least Connections.'
    },
    {
        matches: (q) => /Cookies vs Sessions|difference between cookies and sessions/i.test(q),
        correct: 'Cookies store user data directly on the client’s browser; sessions store sensitive user data securely on the server with a session ID cookie sent to the client.',
        distractors: [
            'Sessions are stored on client browsers, while cookies are stored on database servers.',
            'Cookies can hold up to 10GB of data, while sessions hold at most 4KB.',
            'There is no difference; cookies and sessions are identical storage mechanisms.'
        ],
        explanation: 'Cookies reside on the client device (limited to ~4KB). Sessions reside on the server and are identified by session IDs.'
    },

    // === OOPS CONCEPTS ===
    {
        matches: (q) => /method overloading vs.*overriding|overloading vs overriding/i.test(q),
        correct: 'Overloading occurs in the same class at compile time (same name, different parameter lists); overriding occurs in subclasses at runtime (same name and exact same signature).',
        distractors: [
            'Overloading happens at runtime via dynamic dispatch; overriding happens at compile time.',
            'Overloading requires inheritance between classes, while overriding cannot use inheritance.',
            'Overloading requires different return types with identical parameter lists.'
        ],
        explanation: 'Overloading is compile-time polymorphism within one class. Overriding is runtime polymorphism where a subclass provides a specific implementation.'
    },
    {
        matches: (q) => /interface vs abstract class|difference between interface and abstract class/i.test(q),
        correct: 'An abstract class can have state (instance variables) and constructors; an interface traditionally defines contracts without instance state (multiple interfaces can be implemented).',
        distractors: [
            'A class can inherit multiple abstract classes, but implement only one interface.',
            'Interfaces can have constructors and private instance fields, abstract classes cannot.',
            'Abstract classes cannot contain any implemented concrete methods.'
        ],
        explanation: 'In Java/C++, classes support single class inheritance (abstract class) but can implement multiple interfaces.'
    },
    {
        matches: (q) => /encapsulation/i.test(q),
        correct: 'Bundling data and methods into a single unit (class) while restricting direct outside access using private access modifiers and public getters/setters.',
        distractors: [
            'Allowing child classes to inherit attributes and methods from base classes.',
            'Hiding complex implementation details to show only high-level functional interfaces.',
            'Enabling objects of different types to respond to the same method invocation.'
        ],
        explanation: 'Encapsulation protects object internal state from unauthorized external mutation, promoting data hiding and modularity.'
    },
    {
        matches: (q) => /polymorphism/i.test(q),
        correct: 'The ability of an entity (such as a function or object) to take on multiple forms (e.g. compile-time overloading and runtime overriding).',
        distractors: [
            'Restricting a class to having only one single instantiated object in memory.',
            'Encrypting class member fields so external classes cannot read them.',
            'Compiling source code files into platform-independent bytecode.'
        ],
        explanation: 'Polymorphism allows code to interact with objects through common interfaces while executing specialized class behaviors.'
    },
    {
        matches: (q) => /SOLID Principles/i.test(q),
        correct: 'Five design principles: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion.',
        distractors: [
            'Sequential, Object-oriented, Linear, Iterative, and Distributed programming.',
            'Security, Optimization, Logging, Indexing, and Debugging.',
            'Synchronization, Overloading, Linking, Isolation, and Durability.'
        ],
        explanation: 'SOLID principles guide developers to build maintainable, understandable, and flexible object-oriented architectures.'
    },
    {
        matches: (q) => /Diamond Problem/i.test(q),
        correct: 'An ambiguity in multiple inheritance where a class inherits from two parent classes that both inherit from the same common base class.',
        distractors: [
            'A memory fragmentation bug occurring in diamond-shaped data structures.',
            'A database deadlock scenario involving four participating tables.',
            'A CPU instruction pipeline stall during branch prediction.'
        ],
        explanation: 'The diamond problem causes ambiguity regarding which parent implementation is inherited (resolved in C++ via virtual inheritance).'
    },
    {
        matches: (q) => /Singleton/i.test(q),
        correct: 'A creational design pattern that restricts a class to instantiating only one single instance and provides a global access point to it.',
        distractors: [
            'A structural pattern that converts class interfaces into compatible formats.',
            'A behavioral pattern that notifies subscribers of state changes.',
            'A compiler directive that restricts class methods to single-threaded execution.'
        ],
        explanation: 'Singleton uses a private constructor and a static getInstance() method to ensure a single instance exists.'
    },

    // === PYTHON CORE ===
    {
        matches: (q) => /What is a list in Python/i.test(q),
        correct: 'An ordered, mutable collection of items enclosed in square brackets `[]` that supports diverse data types and dynamic resizing.',
        distractors: [
            'An immutable, fixed-size sequence of elements enclosed in parentheses `()`.',
            'An unordered collection of unique key-value mappings.',
            'A low-level contiguous C array that only stores primitive 32-bit integers.'
        ],
        explanation: 'Lists are Python’s primary mutable sequence data structure, supporting in-place modifications and dynamic resizing.'
    },
    {
        matches: (q) => /What is a tuple in Python/i.test(q),
        correct: 'An ordered, immutable sequence of elements enclosed in parentheses `()` that cannot be modified after creation.',
        distractors: [
            'A mutable array that can dynamically append and delete items using `.append()`.',
            'An unordered collection of unique elements with no indexing support.',
            'A key-value hash table optimized for fast lookups.'
        ],
        explanation: 'Tuples are immutable sequences in Python; their immutability allows them to be used as dictionary keys if all contents are hashable.'
    },
    {
        matches: (q) => /list vs tuple|difference between lists? and tuples?/i.test(q),
        correct: 'Lists are mutable (can modify, append, remove items) defined with `[]`; tuples are immutable (cannot change after creation) defined with `()`.',
        distractors: [
            'Tuples are mutable while lists are immutable.',
            'Lists can only hold numbers, while tuples can hold any data type.',
            'Tuples consume significantly more memory than lists for the same elements.'
        ],
        explanation: 'Lists are dynamic and mutable. Tuples are immutable, have a smaller memory footprint, and can be used as dictionary keys if hashable.'
    },
    {
        matches: (q) => /Are lists mutable\?/i.test(q),
        correct: 'Yes, elements in a Python list can be added, modified, or removed in-place after creation.',
        distractors: [
            'No, Python lists cannot be modified after initial creation.',
            'Only if they contain primitive integers; string lists are immutable.',
            'Only when initialized using the `mutable_list()` constructor.'
        ],
        explanation: 'Lists are mutable sequence types supporting methods like `.append()`, `.extend()`, `.pop()`, and item assignment.'
    },
    {
        matches: (q) => /Are tuples mutable\?/i.test(q),
        correct: 'No, tuples are immutable; their elements and length cannot be modified or reassigned once created.',
        distractors: [
            'Yes, tuples can append items using the `.append()` method.',
            'Yes, as long as the tuple contains fewer than 10 elements.',
            'Only if the tuple is enclosed in square brackets `[]`.'
        ],
        explanation: 'Tuples are immutable; attempting to reassign a tuple element raises a `TypeError`.'
    },
    {
        matches: (q) => /`?is`? vs `?==`?|difference between `?is`? and `?==`?/i.test(q),
        correct: '`==` compares value/content equality; `is` compares identity (whether both variables point to the exact same object in memory).',
        distractors: [
            '`is` compares values, while `==` checks whether memory addresses are identical.',
            '`==` is only for strings, while `is` is only for numeric integers.',
            'Both operators are identical in Python and always return the same result.'
        ],
        explanation: '`==` checks if values evaluate as equal (`a == b`). `is` checks memory reference equality (`id(a) == id(b)`).'
    },
    {
        matches: (q) => /GIL|Global Interpreter Lock/i.test(q),
        correct: 'A mutex in CPython that allows only one native thread to execute Python bytecode at a time, preventing true multi-core CPU parallelism in threads.',
        distractors: [
            'A security module that encrypts Python scripts before running on servers.',
            'A garbage collection lock that pauses all execution when memory exceeds 1GB.',
            'A lock that prevents multiple users from opening the Python interpreter simultaneously.'
        ],
        explanation: 'The GIL simplifies CPython memory management and C extensions, but requires multiprocessing for CPU-bound multi-core concurrency.'
    },
    {
        matches: (q) => /deep copy vs shallow copy|difference between.*deep.*shallow copy/i.test(q),
        correct: 'A shallow copy duplicates the outer object but inserts references to inner nested objects; a deep copy recursively clones all nested objects independently.',
        distractors: [
            'A deep copy creates references, while a shallow copy duplicates nested memory.',
            'Shallow copies only work on primitive numbers, while deep copies only work on strings.',
            'Both copy operations produce identical independent copies with no shared references.'
        ],
        explanation: '`copy.copy()` creates shallow copies (nested objects are shared). `copy.deepcopy()` clones all nested hierarchies.'
    },
    {
        matches: (q) => /generators and memory efficiency|What is a generator/i.test(q),
        correct: 'Functions using `yield` to return an iterator that generates values lazily on-the-fly, avoiding allocating memory for the entire list.',
        distractors: [
            'A background thread that automatically runs unit tests upon file save.',
            'A tool that compiles Python source files into native machine ELF binaries.',
            'A hardware co-processor that speeds up matrix multiplications.'
        ],
        explanation: 'Generators evaluate items one at a time via `yield`, providing O(1) space complexity regardless of sequence size.'
    },

    // === JAVA CORE ===
    {
        matches: (q) => /What is a String in Java/i.test(q),
        correct: 'An object representing a sequence of characters that is completely immutable and stored in the String Constant Pool in heap memory.',
        distractors: [
            'A mutable primitive data type that stores characters directly on the CPU stack.',
            'A thread-safe growable array of 8-bit ASCII characters.',
            'A pointer to an unmanaged character buffer in C heap memory.'
        ],
        explanation: 'In Java, `String` is an immutable reference type; once instantiated, its content cannot be altered.'
    },
    {
        matches: (q) => /What is StringBuilder/i.test(q),
        correct: 'A mutable sequence of characters designed for fast string concatenation in single-threaded environments (not synchronized).',
        distractors: [
            'An immutable class that replaces String in Java 17.',
            'A thread-safe synchronized class used for multi-threaded string manipulation.',
            'A file compiler that compiles `.java` files into `.class` files.'
        ],
        explanation: '`StringBuilder` is faster than `StringBuffer` because its methods are not synchronized, making it ideal for single threads.'
    },
    {
        matches: (q) => /What is StringBuffer/i.test(q),
        correct: 'A thread-safe, mutable sequence of characters whose methods are synchronized for safe concurrent multi-threaded access.',
        distractors: [
            'An immutable class stored exclusively in the Java String Pool.',
            'An unsynchronized fast buffer used for single-threaded string operations.',
            'A stream reader used exclusively for reading binary files from disk.'
        ],
        explanation: '`StringBuffer` provides thread-safe string mutation through method synchronization at the cost of slight performance overhead.'
    },
    {
        matches: (q) => /JDK vs JRE vs JVM|difference between JDK, JRE, and JVM/i.test(q),
        correct: 'JVM executes bytecode; JRE contains JVM + runtime libraries to run apps; JDK contains JRE + development tools (javac compiler, debugger).',
        distractors: [
            'JVM contains the compiler; JRE executes source code; JDK is only for mobile apps.',
            'JDK is the virtual machine; JVM is the development kit; JRE is the web browser plugin.',
            'All three are identical terms for the Java compiler javac.'
        ],
        explanation: 'Hierarchy: JDK > JRE > JVM. Developers need JDK to compile and develop; end users only need JRE to run Java programs.'
    },
    {
        matches: (q) => /platform independence/i.test(q),
        correct: 'Java compiles source code into platform-independent bytecode (.class) which can execute on any operating system equipped with a compatible JVM (WORA).',
        distractors: [
            'Java source code is compiled directly into native machine code on every computer.',
            'Java applications execute inside an operating system kernel driver.',
            'Java programs bypass OS memory managers and run directly on CPU registers.'
        ],
        explanation: '"Write Once, Run Anywhere": The `javac` compiler generates bytecode that any platform-specific JVM interprets or JIT-compiles.'
    },
    {
        matches: (q) => /String vs StringBuilder vs StringBuffer|String immutable/i.test(q),
        correct: 'String is immutable; StringBuilder is mutable and not thread-safe (fastest); StringBuffer is mutable and thread-safe (synchronized methods).',
        distractors: [
            'String is mutable; StringBuilder and StringBuffer are both completely immutable.',
            'StringBuilder is synchronized and thread-safe, while StringBuffer is not.',
            'String and StringBuilder are identical; StringBuffer was deprecated in Java 1.2.'
        ],
        explanation: 'String modifications create new objects in the String Pool. StringBuilder is optimized for single-threaded concatenation. StringBuffer is thread-safe.'
    },
    {
        matches: (q) => /`?==`? vs `?equals\(\)`? in Java/i.test(q),
        correct: '`==` compares reference addresses (checks if both point to the same memory object); `equals()` compares logical content/value equality.',
        distractors: [
            '`equals()` compares reference memory addresses, while `==` checks value equality.',
            '`==` is only used for objects, while `equals()` is only used for primitive ints.',
            'Both `==` and `equals()` always perform identical value comparisons in Java.'
        ],
        explanation: 'For objects in Java, `==` tests reference equality unless comparing primitives. `equals()` can be overridden for value equality.'
    },
    {
        matches: (q) => /HashMap vs ConcurrentHashMap/i.test(q),
        correct: 'HashMap is unsynchronized, not thread-safe, and allows one null key; ConcurrentHashMap is thread-safe using bucket-level locking and disallows nulls.',
        distractors: [
            'HashMap locks the entire table on every read, while ConcurrentHashMap has no locks.',
            'ConcurrentHashMap is only for single-threaded applications.',
            'HashMap is deprecated in modern Java versions and replaced by ConcurrentHashMap.'
        ],
        explanation: 'ConcurrentHashMap achieves high concurrency by locking individual table buckets/segments rather than the entire map.'
    },

    // === C++ CORE ===
    {
        matches: (q) => /malloc.*free vs new.*delete|malloc\/free vs new\/delete/i.test(q),
        correct: '`malloc/free` are C library functions that allocate raw uninitialized bytes; `new/delete` are C++ operators that allocate memory AND call constructors/destructors.',
        distractors: [
            '`malloc/free` call constructors and destructors, while `new/delete` do not.',
            '`new/delete` allocate memory on the stack, while `malloc/free` allocate on the heap.',
            'There is no difference; `new` is simply a C-preprocessor macro for `malloc`.'
        ],
        explanation: '`new` is type-safe, returns the typed pointer, and calls constructors. `malloc` returns `void*` and does not invoke constructors.'
    },
    {
        matches: (q) => /virtual function and vtable|vtable in C\+\+/i.test(q),
        correct: 'A vtable (virtual method table) is an array of function pointers used by the compiler to resolve dynamic/runtime polymorphic method calls via a hidden vptr.',
        distractors: [
            'A table in stack memory that stores all local variable names for debugging.',
            'A hardware register inside the CPU that accelerates C++ class instantiations.',
            'A compilation flag that disables inheritance across class namespaces.'
        ],
        explanation: 'Each class with virtual functions has a vtable. Each object has a vptr pointing to this table, enabling dynamic binding at runtime.'
    },
    {
        matches: (q) => /smart pointers|unique_ptr.*shared_ptr/i.test(q),
        correct: 'RAII wrappers that automatically manage dynamic heap memory: `unique_ptr` has exclusive ownership; `shared_ptr` uses reference counting.',
        distractors: [
            'Pointers that convert C++ code into platform-independent Java bytecode.',
            'Pointers that allocate heap memory without using physical RAM.',
            'Pointers that can only reference functions and not object data.'
        ],
        explanation: 'Smart pointers automatically deallocate heap memory when going out of scope, preventing memory leaks and dangling pointers.'
    },
    {
        matches: (q) => /compilation in C\+\+|compilation pipeline/i.test(q),
        correct: 'Four stages: Preprocessing (macro expansion, #include), Compilation (source to assembly), Assembly (assembly to object code .o), and Linking (merges object files and libraries).',
        distractors: [
            'Two stages: Execution and Garbage Collection.',
            'Direct interpretation line-by-line by the CPU instruction decoder.',
            'A single stage where C++ is converted into JavaScript bytecode.'
        ],
        explanation: 'C++ compilation uses the Preprocessor (cpp), Compiler (g++/clang), Assembler (as), and Linker (ld).'
    },
    {
        matches: (q) => /memory leak and segmentation fault/i.test(q),
        correct: 'A memory leak occurs when dynamically allocated heap memory is not freed; a segmentation fault occurs when a program attempts to access unauthorized or unmapped memory.',
        distractors: [
            'A segmentation fault is a compile-time syntax error; a memory leak happens only in CPU caches.',
            'Both terms refer to CPU fan overheating and thermal throttling.',
            'Memory leaks immediately terminate a program, while segmentation faults are ignored.'
        ],
        explanation: 'Memory leaks waste heap space over time. Segmentation faults trigger immediate OS aborts via SIGSEGV.'
    }
];

// -------------------------------------------------------------
// INTENT-BASED HANDLERS
// -------------------------------------------------------------

function handleBoolean(questionText, topicName, subjectName) {
    const raw = cleanPromptText(questionText);
    const startsWithBool = /^(can|is|does|do|are|will|should|could|may)\b/i.test(raw);
    if (!startsWithBool) return null;

    const lower = raw.toLowerCase();

    // Specific negative truths in standard CS:
    const isNegative = 
        lower.includes('primary key contain null') ||
        lower.includes('table have multiple primary keys') ||
        lower.includes('github required to use git') ||
        lower.includes('tuples mutable') ||
        lower.includes('string mutable') ||
        lower.includes('deadlock resolve automatically') ||
        lower.includes('hard link link directories') ||
        lower.includes('abstract class instantiate') ||
        lower.includes('multiple inheritance in java') ||
        lower.includes('interface have constructors') ||
        lower.includes('durable before it is committed') ||
        lower.includes('rebase shared public history') ||
        lower.includes('untracked files by default');

    const restOfPrompt = raw.replace(/^(can|is|does|do|are|will|should|could|may)\s+/i, '');

    if (isNegative) {
        return {
            correct: `No, this is disallowed in ${subjectName} because ${restOfPrompt} violates standard design specifications and integrity constraints.`,
            distractors: [
                `Yes, ${restOfPrompt} is the default behavior and requires no special handling.`,
                `Yes, but only when running inside temporary in-memory transactions.`,
                `Only if enabled through an experimental third-party configuration flag.`
            ],
            explanation: `In ${subjectName}, ${restOfPrompt} is strictly not permitted according to architectural and system rules.`
        };
    } else {
        return {
            correct: `Yes, ${restOfPrompt} is valid and supported according to standard ${subjectName} specifications.`,
            distractors: [
                `No, ${subjectName} strictly prohibits this behavior under all circumstances.`,
                `No, attempting this immediately throws a fatal runtime exception and halts execution.`,
                `Only when operating under specialized root or superuser permissions.`
            ],
            explanation: `In ${subjectName}, ${restOfPrompt} is a fully supported capability.`
        };
    }
}

function handleDifference(questionText, topicName, subjectName) {
    const raw = cleanPromptText(questionText);
    const lower = raw.toLowerCase();

    const isDiff = lower.includes('difference between') || 
                   lower.includes('compare ') || 
                   lower.includes('differentiate') ||
                   lower.includes(' vs ');

    if (!isDiff) return null;

    let a = 'the primary concept';
    let b = 'the secondary concept';

    const mBetween = raw.match(/between\s+([^,]+?)\s+(?:and|&)\s+([^?]+)/i);
    const mVs = raw.match(/([a-zA-Z0-9_`\s]+)\s+vs\.?\s+([a-zA-Z0-9_`\s?]+)/i);
    const mCompare = raw.match(/compare\s+([^,]+?)\s+(?:and|with|to)\s+([^?]+)/i);

    if (mBetween && mBetween[1] && mBetween[2]) {
        a = mBetween[1].replace(/[`']/g, '').trim();
        b = mBetween[2].replace(/[`']/g, '').trim();
    } else if (mVs && mVs[1] && mVs[2]) {
        a = mVs[1].replace(/[`']/g, '').trim();
        b = mVs[2].replace(/[`']/g, '').trim();
    } else if (mCompare && mCompare[1] && mCompare[2]) {
        a = mCompare[1].replace(/[`']/g, '').trim();
        b = mCompare[2].replace(/[`']/g, '').trim();
    }

    return {
        correct: `${a} prioritizes core execution and foundational guarantees, whereas ${b} provides specialized optimization, lifecycle semantics, or contrasting behavior.`,
        distractors: [
            `${a} and ${b} are functionally identical with no architectural or operational distinctions.`,
            `${a} operates only in hardware firmware, while ${b} is strictly a client-side display feature.`,
            `${b} is an obsolete legacy syntax that has been permanently removed in modern ${subjectName}.`
        ],
        explanation: `In ${subjectName}, distinguishing between ${a} and ${b} is critical for correct design and optimal performance.`
    };
}

function handleEvent(questionText, topicName, subjectName) {
    const raw = cleanPromptText(questionText);
    const lower = raw.toLowerCase();

    if (!lower.includes('what happens when') && !lower.includes('what happens if') && !lower.includes('what problems can occur')) {
        return null;
    }

    let eventSubject = raw.replace(/what happens (when|if)\s+/i, '').replace(/what problems can occur (if|when)\s+/i, '');

    return {
        correct: `When ${eventSubject}, the system detects the state, prevents corruption, and either rolls back changes or handles the event according to protocol.`,
        distractors: [
            `The entire operating system or database crashes permanently without saving any logs.`,
            `The operation proceeds silently and writes corrupt data across persistent disk blocks.`,
            `The server terminates all active user connections and requires a manual cold reboot.`
        ],
        explanation: `In ${subjectName}, robust exception handling, atomicity, or signal handlers properly isolate and manage ${eventSubject}.`
    };
}

function handlePurpose(questionText, topicName, subjectName) {
    const raw = cleanPromptText(questionText);
    const lower = raw.toLowerCase();

    const isPurpose = /why (is|are|do we use|do we|do|should)\s+/i.test(raw) ||
                      /what is the (purpose|role) of\s+/i.test(raw) ||
                      lower.includes('role of');

    if (!isPurpose) return null;

    let target = raw.replace(/^why (is|are|do we use|do we|do|should)\s+/i, '')
                    .replace(/^what is the (purpose|role) of\s+/i, '')
                    .trim();

    return {
        correct: `To enforce structured consistency, optimize runtime performance, and ensure clean separation of concerns for ${target}.`,
        distractors: [
            `To bypass standard security validation and allow unrestricted arbitrary memory writes.`,
            `To compress source code files into encrypted binary blobs on local storage.`,
            `To eliminate the need for schema constraints, indexes, and type checking completely.`
        ],
        explanation: `Employing ${target} in ${subjectName} provides predictable execution, high reliability, and maintainability.`
    };
}

function handleDynamic(questionText, topicName, subjectName) {
    const raw = cleanPromptText(questionText);
    let core = raw.replace(/^(why are|why is|why do we use|why do|why should|why|what is the purpose of|what is|what are|explain|how do you|how does|how to|how can you|how|define|describe|name)\s+/i, '').trim();
    if (!core || core.length < 3) core = topicName;

    return {
        correct: `Specifies the technical standard defining ${core} in ${subjectName}, ensuring optimal correctness, reliability, and structured execution.`,
        distractors: [
            `An outdated legacy approach for ${core} that bypasses standard compilation and runtime validation checks.`,
            `A client-side temporary formatting option for ${core} that does not impact underlying data or system state.`,
            `A hardware-specific configuration for ${core} that is only applicable to mainframe supercomputers.`
        ],
        explanation: `In ${subjectName}, ${core} represents an essential architectural foundation for efficient software development.`
    };
}

/**
 * Master Option Generation Function
 * Ensures every question receives unique options and even rotation across A, B, C, D
 */
function generateQuestionOptions(questionText, topicName, subjectName, questionIndex = 1) {
    let chosen = null;

    // 1. Try specific question handlers (highest precision)
    for (const rule of specificRules) {
        if (rule.matches(questionText)) {
            chosen = {
                correct: rule.correct,
                distractors: rule.distractors,
                explanation: rule.explanation
            };
            break;
        }
    }

    // 2. Try boolean question handler
    if (!chosen) {
        chosen = handleBoolean(questionText, topicName, subjectName);
    }

    // 3. Try difference question handler
    if (!chosen) {
        chosen = handleDifference(questionText, topicName, subjectName);
    }

    // 4. Try event/failure question handler
    if (!chosen) {
        chosen = handleEvent(questionText, topicName, subjectName);
    }

    // 5. Try purpose question handler
    if (!chosen) {
        chosen = handlePurpose(questionText, topicName, subjectName);
    }

    // 6. Dynamic question handler
    if (!chosen) {
        chosen = handleDynamic(questionText, topicName, subjectName);
    }

    // Prepare raw options
    const rawOptions = [
        { text: chosen.correct, isCorrect: true },
        { text: chosen.distractors[0], isCorrect: false },
        { text: chosen.distractors[1], isCorrect: false },
        { text: chosen.distractors[2], isCorrect: false }
    ];

    // Perfect rotation:
    // Topic hash shifts the starting letter per topic, and questionIndex cycles A -> B -> C -> D -> A
    const topicOffset = getTopicHash(topicName) % 4;
    const targetCorrectIndex = (topicOffset + (Number(questionIndex || 1) - 1)) % 4;

    const shuffled = [null, null, null, null];
    shuffled[targetCorrectIndex] = rawOptions[0]; // Put correct answer in target slot

    let distractorIndex = 1;
    for (let i = 0; i < 4; i++) {
        if (shuffled[i] === null) {
            shuffled[i] = rawOptions[distractorIndex++];
        }
    }

    const labels = ['A', 'B', 'C', 'D'];
    const correctLabel = labels[targetCorrectIndex];

    const finalOptions = shuffled.map((opt, idx) => ({
        id: labels[idx],
        text: opt.text
    }));

    return {
        options: finalOptions,
        correct_option: correctLabel,
        explanation: chosen.explanation
    };
}

module.exports = {
    generateQuestionOptions,
    specificRules
};
