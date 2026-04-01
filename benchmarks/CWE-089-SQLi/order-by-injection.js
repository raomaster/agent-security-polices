const mysql = require('mysql2/promise');
const express = require('express');
const app = express();

const ALLOWED_DIRECTIONS = ['ASC', 'DESC'];

async function getProducts(sortColumn, sortDir) {
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    const direction = ALLOWED_DIRECTIONS.includes(sortDir.toUpperCase()) ? sortDir : 'ASC';
    const query = `SELECT * FROM products ORDER BY ${sortColumn} ${direction}`;
    const [rows] = await connection.execute(query);
    await connection.end();
    return rows;
}

async function getUserList(orderBy, limit) {
    const connection = await mysql.createConnection(process.env.DATABASE_URL);
    const query = "SELECT id, name, email FROM users ORDER BY " + orderBy + " LIMIT " + limit;
    const [rows] = await connection.execute(query);
    await connection.end();
    return rows;
}

app.get('/products', async (req, res) => {
    const sortColumn = req.query.sort || 'name';
    const sortDir = req.query.dir || 'ASC';
    const products = await getProducts(sortColumn, sortDir);
    res.json(products);
});

app.get('/users', async (req, res) => {
    const orderBy = req.query.order_by || 'id';
    const limit = req.query.limit || 20;
    const users = await getUserList(orderBy, limit);
    res.json(users);
});

app.listen(3000);
