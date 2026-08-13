package com.joao_v_marques.certificados_cooperados.repository;

import com.joao_v_marques.certificados_cooperados.entity.Course;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface CourseRepository extends JpaRepository<Course, Integer> {

    interface MemberCourseMinutes {
        Integer getCooperativeMemberId();

        Integer getTotalMinutes();

        Boolean getCooperativism();
    }


    @Query("""
            select c.cooperativeMember.id as cooperativeMemberId,
                   c.totalMinutes as totalMinutes,
                   c.isCooperativism as cooperativism
            from Course c
            where c.completionDate between :start and :end
            """)
    List<MemberCourseMinutes> findMemberMinutesByCompletionDateBetween(@Param("start") LocalDate start,
                                                                       @Param("end") LocalDate end);


    interface MemberCourseDetail {
        Integer getId();

        String getTitle();

        Integer getTotalMinutes();

        LocalDate getCompletionDate();

        Boolean getCooperativism();

        Integer getCertificateId();

        String getCertificateFilename();
    }


    @Query("""
            select c.id as id,
                   c.title as title,
                   c.totalMinutes as totalMinutes,
                   c.completionDate as completionDate,
                   c.isCooperativism as cooperativism,
                   cert.id as certificateId,
                   cert.originalFilename as certificateFilename
            from Course c
            left join CourseCertificate cert on cert.course = c
            where c.cooperativeMember.id = :memberId
              and c.completionDate between :start and :end
            order by c.completionDate desc, c.title asc
            """)
    List<MemberCourseDetail> findDetailsByMemberAndCompletionDateBetween(@Param("memberId") Integer memberId,
                                                                         @Param("start") LocalDate start,
                                                                         @Param("end") LocalDate end);

    @Query("""
            select distinct year(c.completionDate)
            from Course c
            order by year(c.completionDate) desc
            """)
    List<Integer> findDistinctCompletionYears();
}
