package com.example.aicoach.controller;

import com.example.aicoach.dto.*;
import com.example.aicoach.service.SuggestionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@CrossOrigin(origins = "*")
public class SuggestionController {
    
    @Autowired
    private SuggestionService suggestionService;
    
    /**
     * 获取提示问题建议
     */
    @PostMapping("/suggestions")
    public ResponseEntity<Map<String, Object>> getSuggestions(@RequestBody SuggestionRequest request) {
        try {
            // 验证参数
            if (request.getStage() == null || request.getStage() < 1) {
                return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "阶段参数无效"
                ));
            }
            
            // 生成提示问题
            List<SuggestionItem> suggestions = suggestionService.generateSuggestions(
                request.getStage(),
                request.getLearningPlan(),
                request.getUserProfile()
            );
            
            // 返回结果
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("suggestions", suggestions);
            response.put("stage", request.getStage());
            response.put("count", suggestions.size());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "获取提示问题失败: " + e.getMessage());
            errorResponse.put("stage", request.getStage());
            
            return ResponseEntity.internalServerError().body(errorResponse);
        }
    }
}