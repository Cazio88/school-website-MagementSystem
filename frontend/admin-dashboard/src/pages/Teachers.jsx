import { useEffect, useState } from "react";
import API from "../services/api";

const Teachers = () => {

  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    subject: "",
    school_class: "",
    hire_date: ""
  });

  useEffect(() => {
    loadTeachers();
    loadSubjects();
    loadClasses();
  }, []);

  const loadTeachers = async () => {
    try {
      const res = await API.get("/teachers/");
      setTeachers(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadSubjects = async () => {
    try {
      const res = await API.get("/subjects/");
      setSubjects(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const loadClasses = async () => {
    try {
      const res = await API.get("/classes/");
      setClasses(res.data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleChange = (e) => {

    setForm({
      ...form,
      [e.target.name]: e.target.value
    });

  };

  const createTeacher = async (e) => {

  e.preventDefault();

  try {

    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      subject: Number(form.subject),
      school_class: Number(form.school_class),
      hire_date: form.hire_date
    };

    await API.post("/teachers/", payload);

    alert("Teacher created successfully");

    setForm({
      first_name: "",
      last_name: "",
      subject: "",
      school_class: "",
      hire_date: ""
    });

    loadTeachers();

  } catch (error) {
    console.error(error.response?.data);
  }

};

  const deleteTeacher = async (id) => {

    if (!window.confirm("Delete this teacher?")) return;

    try {

      await API.delete(`/teachers/${id}/`);

      loadTeachers();

    } catch (error) {
      console.error(error);
    }

  };

  return (

    <div className="p-6">

      <h1 className="text-2xl font-bold mb-6">
        Teachers
      </h1>

      {/* Create Teacher */}

      <form
        onSubmit={createTeacher}
        className="bg-white shadow p-4 rounded mb-6 grid grid-cols-3 gap-4"
      >

        <input
          type="text"
          name="first_name"
          placeholder="First Name"
          value={form.first_name}
          onChange={handleChange}
          className="border p-2"
          required
        />

        <input
          type="text"
          name="last_name"
          placeholder="Last Name"
          value={form.last_name}
          onChange={handleChange}
          className="border p-2"
          required
        />

        <input
          type="date"
          name="hire_date"
          value={form.hire_date}
          onChange={handleChange}
          className="border p-2"
          required
        />

        <select
          name="subject"
          value={form.subject}
          onChange={handleChange}
          className="border p-2"
          required
        >
          <option value="">Select Subject</option>

          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}

        </select>

        <select
          name="school_class"
          value={form.school_class}
          onChange={handleChange}
          className="border p-2"
          required
        >
          <option value="">Select Class</option>

          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}

        </select>

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded col-span-3"
        >
          Create Teacher
        </button>

      </form>

      {/* Teachers Table */}

      <table className="w-full border shadow rounded">

        <thead className="bg-gray-200">

          <tr>
            <th className="p-2">Teacher ID</th>
            <th className="p-2">Name</th>
            <th className="p-2">Subject</th>
            <th className="p-2">Class</th>
            <th className="p-2">Hire Date</th>
            <th className="p-2">Actions</th>
          </tr>

        </thead>

        <tbody>

          {teachers.map((t) => (

            <tr key={t.id} className="border-t">

              <td className="p-2">{t.teacher_id}</td>
              <td className="p-2">{t.teacher_name}</td>
              <td className="p-2">{t.subject_name}</td>
              <td className="p-2">{t.class_name}</td>
              <td className="p-2">{t.hire_date}</td>

              <td className="p-2">

                <button
                  onClick={() => deleteTeacher(t.id)}
                  className="bg-red-600 text-white px-3 py-1 rounded"
                >
                  Delete
                </button>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );

};

export default Teachers;