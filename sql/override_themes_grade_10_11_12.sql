-- Override Themes for Grade 10, 11, 12 for Academic Year 2026/2027

-- Delete existing themes for Grades 10, 11, 12
DELETE FROM themes 
WHERE grade IN ('10', '11', '12') 
AND academic_year = '2026/2027';

-- Insert new themes for Grade 10
INSERT INTO themes (theme_name, grade, academic_year) VALUES
('Sustainable Environment', '10', '2026/2027'),
('Green Innovation', '10', '2026/2027'),
('Smart Environment', '10', '2026/2027'),
('Living in Harmony with Nature', '10', '2026/2027');

-- Insert new themes for Grade 11
INSERT INTO themes (theme_name, grade, academic_year) VALUES
('Smart Agriculture & Food Security', '11', '2026/2027'),
('Future sustainable food', '11', '2026/2027'),
('Zero Food Waste', '11', '2026/2027'),
('Sustainable Culinary Innovation', '11', '2026/2027');

-- Insert new themes for Grade 12
INSERT INTO themes (theme_name, grade, academic_year) VALUES
('AI for sustainable future', '12', '2026/2027'),
('Digital Transformation', '12', '2026/2027'),
('Creating a Smart Digital Society', '12', '2026/2027'),
('Technology for humanity', '12', '2026/2027'),
('Future smart business', '12', '2026/2027');
