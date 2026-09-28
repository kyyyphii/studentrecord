<?php

define('DB_HOST', '127.0.0.1');
define('DB_NAME', 'student_db');     
define('DB_USER', 'root');           
define('DB_PASS', '');               
function getDB(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $server = new PDO("mysql:host=" . DB_HOST . ";charset=utf8mb4", DB_USER, DB_PASS);
    $server->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $server->exec("CREATE DATABASE IF NOT EXISTS " . DB_NAME . " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS
    );
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS students (
            id INT AUTO_INCREMENT PRIMARY KEY,
            student_id VARCHAR(50) NOT NULL UNIQUE,
            name VARCHAR(150) NOT NULL,
            program VARCHAR(150) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS students_archive (
            archive_id INT AUTO_INCREMENT PRIMARY KEY,
            original_id INT,
            student_id VARCHAR(50),
            name VARCHAR(150),
            program VARCHAR(150),
            created_at DATETIME,
            updated_at DATETIME,
            deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");

    return $pdo;
}