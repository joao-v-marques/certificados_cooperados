package com.joao_v_marques.certificados_cooperados.dto;

import jakarta.validation.constraints.*;

public record UserRequest(

        @NotBlank(message = "Preencha o campo de usuário.")
        @Size(max = 155, message = "O campo de usuário deve ter no máximo 155 caracteres")
        String username,

        @Size(max = 255, message = "O nome do usuário deve ter no máximo 255 caracteres")
        String name,

        @NotBlank(message = "Informe a senha do usuário")
        @Size(min = 4, max = 72, message = "A senha deve ter entre 4 e 72 caracteres")
        String password,

        @Size(max = 255, message = "O email deve ter no máximo 255 caracteres")
        @Email(message = "Informe um email válido")
        String email,

        @NotNull(message = "Informe o perfil de acesso do usuário")
        @Positive(message = "Perfil de acesso inválido")
        Integer roleId
) {
}
