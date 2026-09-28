<?php

header('Content-Type: application/json');
require_once __DIR__ . '/../includes/config.php';

$pdo = getDB();
$rows = $pdo->query('SELECT * FROM students_archive ORDER BY archive_id DESC')->fetchAll();

echo json_encode(['ok' => true, 'data' => $rows]);