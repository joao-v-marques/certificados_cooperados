package com.joao_v_marques.certificados_cooperados.service;

import com.joao_v_marques.certificados_cooperados.dto.CurrentUserResponse;
import com.joao_v_marques.certificados_cooperados.dto.UserResponse;
import com.joao_v_marques.certificados_cooperados.entity.User;
import com.joao_v_marques.certificados_cooperados.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.List;
import java.util.Set;

@Service
public class UserService {

    // Partículas não viram inicial: "João de Freitas" é JF, e não JD.
    private static final Set<String> NAME_PARTICLES =
            Set.of("de", "da", "do", "das", "dos", "e", "del", "di", "van", "von");

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

    /**
     * Dados do usuário autenticado para a topbar.
     *
     * Lê do banco em vez de aproveitar o que já está no SecurityContext de
     * propósito: o token vive 24h, e nesse intervalo o nome ou o e-mail podem ter
     * mudado — a tela mostra o cadastro de agora, não o de quando o login foi feito.
     */
    @Transactional(readOnly = true)
    public CurrentUserResponse findCurrent(Integer userId) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("Usuário autenticado não encontrado."));

        // O nome é opcional no cadastro; sem ele o username é o que identifica
        // a pessoa na tela.
        String displayName = StringUtils.hasText(user.getName())
                ? user.getName().trim()
                : user.getUsername();

        return new CurrentUserResponse(displayName, user.getEmail(), initialsOf(displayName));
    }

    /**
     * Iniciais do avatar: primeira letra do primeiro nome e do último sobrenome.
     * Nome de uma palavra só rende uma letra — melhor do que repetir a mesma.
     */
    private String initialsOf(String displayName) {

        List<String> words = Arrays.stream(displayName.trim().split("\\s+"))
                .filter(word -> !word.isBlank())
                .toList();

        if (words.isEmpty()) {
            return "";
        }

        List<String> names = words.stream()
                .filter(word -> !NAME_PARTICLES.contains(word.toLowerCase()))
                .toList();

        // Um nome só de partículas não deveria existir, mas se existir é melhor
        // usar as palavras cruas do que devolver iniciais vazias.
        if (names.isEmpty()) {
            names = words;
        }

        String first = names.get(0).substring(0, 1);
        String last = names.size() > 1 ? names.get(names.size() - 1).substring(0, 1) : "";

        return (first + last).toUpperCase();
    }
}
