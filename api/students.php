<?php

header('Content-Type: application/json');
require_once __DIR__ . '/../includes/config.php';

$pdo    = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$id     = isset($_GET['id']) ? (int) $_GET['id'] : null;

function respond(int $httpCode, array $payload): void {
    http_response_code($httpCode);
    echo json_encode($payload);
    exit;
}

function readJsonBody(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

switch ($method) {

    case 'POST': {
        $body = readJsonBody();
        $studentId = trim($body['student_id'] ?? '');
        $name      = trim($body['name'] ?? '');
        $program   = trim($body['program'] ?? '');

        if ($studentId === '' || $name === '' || $program === '') {
            respond(400, ['ok' => false, 'error' => 'student_id, name and program are all required.']);
        }

        try {
            $stmt = $pdo->prepare(
                'INSERT INTO students (student_id, name, program) VALUES (?, ?, ?)'
            );
            $stmt->execute([$studentId, $name, $program]);
            $newId = $pdo->lastInsertId();

            $row = $pdo->prepare('SELECT * FROM students WHERE id = ?');
            $row->execute([$newId]);

            respond(201, [
                'ok' => true,
                'message' => 'Student record created.',
                'data' => $row->fetch(),
            ]);
        } catch (PDOException $e) {
            if (str_contains($e->getMessage(), 'UNIQUE') || str_contains($e->getMessage(), 'Duplicate entry')) {
                respond(409, ['ok' => false, 'error' => "Student ID \"$studentId\" already exists."]);
            }
            respond(500, ['ok' => false, 'error' => 'Database error: ' . $e->getMessage()]);
        }
        break;
    }

    case 'GET': {
        if ($id) {
            $stmt = $pdo->prepare('SELECT * FROM students WHERE id = ?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            if (!$row) respond(404, ['ok' => false, 'error' => 'Student not found.']);
            respond(200, ['ok' => true, 'data' => $row]);
        } else {
            $rows = $pdo->query('SELECT * FROM students ORDER BY id DESC')->fetchAll();
            respond(200, ['ok' => true, 'data' => $rows]);
        }
        break;
    }

    case 'PUT': {
        if (!$id) respond(400, ['ok' => false, 'error' => 'Missing id.']);

        $check = $pdo->prepare('SELECT * FROM students WHERE id = ?');
        $check->execute([$id]);
        if (!$check->fetch()) respond(404, ['ok' => false, 'error' => 'Student not found.']);

        $body = readJsonBody();
        $studentId = trim($body['student_id'] ?? '');
        $name      = trim($body['name'] ?? '');
        $program   = trim($body['program'] ?? '');

        if ($studentId === '' || $name === '' || $program === '') {
            respond(400, ['ok' => false, 'error' => 'student_id, name and program are all required.']);
        }

        try {
            $stmt = $pdo->prepare(
                "UPDATE students SET student_id = ?, name = ?, program = ?, updated_at = NOW() WHERE id = ?"
            );
            $stmt->execute([$studentId, $name, $program, $id]);

            $row = $pdo->prepare('SELECT * FROM students WHERE id = ?');
            $row->execute([$id]);

            respond(200, [
                'ok' => true,
                'message' => 'Student record updated.',
                'data' => $row->fetch(),
            ]);
        } catch (PDOException $e) {
            if (str_contains($e->getMessage(), 'UNIQUE') || str_contains($e->getMessage(), 'Duplicate entry')) {
                respond(409, ['ok' => false, 'error' => "Student ID \"$studentId\" already exists."]);
            }
            respond(500, ['ok' => false, 'error' => 'Database error: ' . $e->getMessage()]);
        }
        break;
    }

    case 'DELETE': {
        if (!$id) respond(400, ['ok' => false, 'error' => 'Missing id.']);

        $check = $pdo->prepare('SELECT * FROM students WHERE id = ?');
        $check->execute([$id]);
        $existing = $check->fetch();
        if (!$existing) respond(404, ['ok' => false, 'error' => 'Student not found.']);

        try {
            $pdo->beginTransaction();

            $archive = $pdo->prepare('
                INSERT INTO students_archive (original_id, student_id, name, program, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            ');
            $archive->execute([
                $existing['id'], $existing['student_id'], $existing['name'],
                $existing['program'], $existing['created_at'], $existing['updated_at'],
            ]);

            $del = $pdo->prepare('DELETE FROM students WHERE id = ?');
            $del->execute([$id]);

            $pdo->commit();

            respond(200, [
                'ok' => true,
                'message' => "Student \"{$existing['name']}\" archived (soft-deleted), not permanently removed.",
            ]);
        } catch (PDOException $e) {
            $pdo->rollBack();
            respond(500, ['ok' => false, 'error' => 'Database error: ' . $e->getMessage()]);
        }
        break;
    }

    default:
        respond(405, ['ok' => false, 'error' => 'Method not allowed.']);
}