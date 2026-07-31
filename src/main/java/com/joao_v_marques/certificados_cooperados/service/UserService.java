package com.joao_v_marques.certificados_cooperados.service;

import com.joao_v_marques.certificados_cooperados.dto.CurrentUserResponse;
import com.joao_v_marques.certificados_cooperados.dto.UserRequest;
import com.joao_v_marques.certificados_cooperados.dto.UserResponse;
import com.joao_v_marques.certificados_cooperados.entity.Role;
import com.joao_v_marques.certificados_cooperados.entity.User;
import com.joao_v_marques.certificados_cooperados.repository.RoleRepository;
import com.joao_v_marques.certificados_cooperados.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.List;
import java.util.Set;

@Service
public class UserService {

    // Partículas não viram iniciais: "João de Freitas" é JF, e não JD.
    private static final Set<String> NAME_PARTICLES = Set.of("de", "da", "do", "das", "dos", "e", "del", "di", "van", "von");

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository,
                       RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<UserResponse> findAll() {
        return userRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public CurrentUserResponse findCurrent(Integer userId) {

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalStateException("Usuário autenticado não encontrado."));

        // O nome é opcional no cadastro; sem ele o username é o que identifica
        // a pessoa na tela.
        String displayName = StringUtils.hasText(user.getName())
                ? user.getName().trim()
                : user.getUsername();

        return new CurrentUserResponse(displayName, user.getEmail(), initialsOf(displayName), user.getRole().getName());
    }

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

    // POST de um novo User
    @Transactional
    public UserResponse create(UserRequest userRequest) {

        String username = userRequest.username().trim();

        // Nome e email são opcionais: o formulário manda string vazia quando não
        // preenchem, e "" gravado é pior que null — o findCurrent trataria "" como
        // nome válido e a topbar ficaria sem identificação nenhuma.
        String name = StringUtils.hasText(userRequest.name()) ? userRequest.name().trim() : null;
        String email = StringUtils.hasText(userRequest.email()) ? userRequest.email().trim() : null;

        // regras de negócio que a anotação de validation da dto não cobre
        if (userRepository.existsByUsernameIgnoreCase(username)) {
            throw new IllegalArgumentException("Já existe um usuário com esse nome de usuário.");
        }

        // O perfil vem por id, então precisa existir de verdade: id inventado é
        // regra violada, e não erro de servidor.
        Role role = roleRepository.findById(userRequest.roleId())
                .orElseThrow(() -> new IllegalArgumentException("Perfil de acesso não encontrado."));

        // Montar a entidade, um dto nunca vira entidade sozinho
        User user = new User();
        user.setUsername(username);
        user.setName(name);
        user.setEmail(email);
        user.setRole(role);

        // A senha em claro morre aqui: o que entra na entidade já é o hash, e a
        // UserResponse não tem campo para devolvê-la.
        user.setPasswordHash(passwordEncoder.encode(userRequest.password()));

        User saved = userRepository.save(user);

        return toResponse(saved);
    }

    private UserResponse toResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getName(),
                user.getEmail(),
                user.getCreatedAt(),
                user.getRole().getName(),
                user.isActive()
        );
    }
}
