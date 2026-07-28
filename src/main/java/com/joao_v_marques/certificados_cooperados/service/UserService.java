package com.joao_v_marques.certificados_cooperados.service;

import com.joao_v_marques.certificados_cooperados.dto.UserResponse;
import com.joao_v_marques.certificados_cooperados.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<UserResponse> findAll() {
        return userRepository.findAll()
                .stream()
                .map(user -> new UserResponse(
                        user.getId(),
                        user.getUsername(),
                        user.getName(),
                        user.getEmail(),
                        user.getCreatedAt(),
                        user.getRole().getName(),
                        user.isActive()
                ))
                .toList();
    }
}
