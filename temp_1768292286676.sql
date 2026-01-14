INSERT INTO missing_persons_info (
    case_id, case_url, images_json, missing_state, missing_county, missing_city, image_count, image_webp_status, html_status
) VALUES (
    'test-case-1', 
    'https://example.com/cases/test-case-1', 
    '["https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Cat03.jpg/440px-Cat03.jpg", "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Cat_poster_1.jpg/440px-Cat_poster_1.jpg"]', 
    'California', 
    'Los Angeles County', 
    'Los Angeles', 
    2, 
    0, 
    200
);