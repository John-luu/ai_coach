package com.example.aicoach.controller;

import com.example.aicoach.dto.AssessmentRequest;
import com.example.aicoach.dto.AssessmentResult;
import com.example.aicoach.service.AssessmentService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/assessment")
@CrossOrigin // 允许前端 http://localhost:5000 等域访问
public class AssessmentController {

    private final AssessmentService assessmentService;

    public AssessmentController(AssessmentService assessmentService) {
        this.assessmentService = assessmentService;
    }

    @PostMapping("/evaluate")
    public AssessmentResult evaluate(@RequestBody AssessmentRequest request) {
        return assessmentService.evaluate(request);
    }
}

