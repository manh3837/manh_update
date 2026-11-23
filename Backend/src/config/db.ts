import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// Tạo connection pool để tái sử dụng kết nối
export const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "ducbinh1",
  database: process.env.DB_NAME || "quanlyrapchieuphim",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
});

export async function testConnection(): Promise<void> {
  try {
    const conn = await pool.getConnection();
    console.log("MySQL connected:", process.env.DB_NAME);
    conn.release();
  } catch (err) {
    console.error("MySQL connection failed:", err);
    process.exit(1);
  }
}
