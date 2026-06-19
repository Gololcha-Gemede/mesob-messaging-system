ALTER TABLE departments ADD COLUMN code VARCHAR(10) NULL AFTER name;
CREATE UNIQUE INDEX uniq_dept_code ON departments (code);
